'use strict';

import request from 'request';
import {ExifImage} from 'exif';
import moment from 'moment';
import Logger from '../utils/Logger';

const logger = new Logger('FileSharedCommand');

export default class {
  constructor(slack, usersService, filesService) {
    this.usersService = usersService;
    this.filesService = filesService;

    slack.on('event', async (payload, client) => {
      if (payload.token !== process.env.SLACK_VERIFICATION_TOKEN) {
        logger.log('Forbidden');
        return;
      }

      this.client = client;

      try {
        await this.handleEvent(payload)
      } catch (e) {
        logger.log('ERROR', e.message);
      }
    });

    slack.on('*', (payload, client) => {
      if (payload.token !== process.env.SLACK_VERIFICATION_TOKEN) {
        logger.log('Forbidden');
        return;
      }

      this.client = client;

      try {
        this.handleResponse(payload)
      } catch (e) {
        logger.log('ERROR', e.message);
      }
    });
  }

  async handleEvent(payload) {
    logger.log('Received event', payload.event.type);

    if (payload.event.type !== 'file_shared') {
      logger.log('Unsupported event');
      return;
    }

    logger.log('Processing payload', payload);

    const user = await this.ensureUserExists(payload.event.user_id);
    if (user.ignoreFilesShared) {
      logger.log('User disabled uploading files');
      return;
    }

    const file = await this.getFile(payload.event.file_id);
    if (file.file.mimetype !== 'image/jpeg') {
      logger.log('Unsupported mime type', file.file.mimetype);
      return;
    }

    const buffer = await this.loadFileContent(file);
    const exifData = await this.loadExifData(buffer);
    if (!this.hasRequiredData(exifData)) {
      logger.log('Required EXIF data is missing')
      return;
    }

    await this.storeFile(file, exifData, user);

    const message = this.createConfirmationMessage(file.file);
    logger.log('SENDING', message);

    message.channel = file.file.channels && file.file.channels.length ? file.file.channels[0] : payload.event.user_id;
    message.token = process.env.OAUTH_ACCESS_TOKEN;

    logger.log('SENDING', message);

    this.client.send('chat.postMessage', message).catch((e) => {throw new Error(e.error)});
  }

  async handleResponse(payload) {
    if (payload.type === 'interactive_message' && payload.actions.length) {
      if (payload.actions[0].name === 'allow') {
        await this.allowOnMap(payload.callback_id);
        this.client.replyPrivate('Your file got added to the map.');
      } else if (payload.actions[0].name === 'disallow') {
        await this.deleteFile(payload.callback_id);
        this.client.replyPrivate('Your file got discarded.');
      } else if (payload.actions[0].name === 'disallow_forever') {
        await Promise.all([
          this.deleteFile(payload.callback_id),
          this.disallowForever(payload.user.id)
        ]);
        this.client.replyPrivate('Your file got discarded. You\'ll never be bothered again.');
      }
    }
  }

  createConfirmationMessage(file) {
    return {
      text: 'Do you want to show the image you just uploaded on your team\'s map?',
      attachments: JSON.stringify([
        {
          callback_id: file.id,
          fallback: file.id,
          color: 'good',
          actions: [
            {
              name: 'allow',
              text: 'Yes',
              type: 'button',
              value: file.id,
              style: 'good'
            },
            {
              name: 'disallow',
              text: 'No',
              type: 'button',
              value: file.id,
              style: 'warning'
            },
            {
              name: 'disallow_forever',
              text: 'No. Don\'t ask again.',
              type: 'button',
              value: file.id,
              style: 'danger'
            }
          ]
        }
      ])
    };
  }

  disallowForever(userId) {
    return this.usersService.update(userId, 'SET ignoreFilesShared = :ignoreFilesShared', {':ignoreFilesShared': true});
  }

  deleteFile(fileId) {
    return this.filesService.delete(fileId);
  }

  allowOnMap(fileId) {
    return this.filesService.update(fileId, 'SET isAllowed = :isAllowed', {':isAllowed': true});
  }

  async ensureUserExists(userId) {
    logger.log('Loading user', userId);

    let user = await this.usersService.get(userId);
    if (!user) {
      logger.log('User does not exist');

      let slackUser;
      try {
        slackUser = await this.client.send('users.info', {
          token: process.env.OAUTH_ACCESS_TOKEN,
          user: userId
        });
      } catch (e) {
        logger.log('Unable to fetch user', e);
        throw e;
      }

      logger.log('Loaded user data', user);

      user = {
        id: userId,
        username: slackUser.user.name,
        fullName: slackUser.user.real_name,
        ignoreFilesShared: false
      };

      logger.log('Saving user data', user);
      await this.usersService.put(user);
    }

    return user;
  }

  async getFile(fileId) {
    logger.log('Loading file', fileId);

    try {
      const file = await this.client.send('files.info', {
        token: process.env.OAUTH_ACCESS_TOKEN,
        file: fileId
      });
      logger.log('Loaded file data', file);
      return file;
    } catch (e) {
      logger.log('Unable to fetch file', e);
      throw e;
    }
  }

  async loadFileContent(file) {
    try {
      logger.log('Downloading file from', file.file.url_private);
      const buffer = await this._request(file.file.url_private);
      logger.log('File downloaded');
      return buffer;
    } catch (e) {
      logger.log('Unable to download file', e);
      throw e;
    }
  }

  loadExifData(buffer) {
    return new Promise(function (resolve, reject) {
      new ExifImage({image: buffer}, function (error, exifData) {
        if (error) {
          logger.log('Unable to load EXIF data', error);
          reject(error);
        } else {
          logger.log('Loaded EXIF data', exifData);
          resolve(exifData);
        }
      });
    });
  }

  hasRequiredData(exifData) {
    return exifData.exif.CreateDate && exifData.gps.GPSLatitudeRef;
  }

  storeFile(file, exifData, user, isAllowedOnMap) {
    let lat = this._calculateDecimalCoordinate(exifData.gps.GPSLatitude, exifData.gps.GPSLatitudeRef);
    let lng = this._calculateDecimalCoordinate(exifData.gps.GPSLongitude, exifData.gps.GPSLongitudeRef);

    const fileData = {
      id: file.file.id,
      url: file.file.url_private,
      thumbnailUrl: file.file.thumb_80,
      createdAt: moment(exifData.exif.CreateDate, "YYYY:MM:DD").format('YYYY-MM-DD'),
      lat,
      lng,
      user,
      isAllowed: !!isAllowedOnMap
    };

    logger.log('Saving file ', fileData);
    return this.filesService.put(fileData);
  }

  _calculateDecimalCoordinate(data, ref) {
    let decimal = data[0] + data[1] / 60 + data[2] / 3600;
    if (ref === 'W' || ref === 'S') {
      decimal *= -1;
    }

    return decimal;
  }

  _request(url) {
    const options = {
      encoding: null,
      headers: {
        'Authorization': 'Bearer ' + process.env.OAUTH_ACCESS_TOKEN
      },
      url
    };

    return new Promise(function (resolve, reject) {
      request(options, function (error, res, body) {
        if (!error && res.statusCode === 200) {
          resolve(body);
        } else {
          reject(error);
        }
      });
    });
  }
}