'use strict';

import request from 'request';
import {ExifImage} from 'exif';
import moment from 'moment';

export default class {
  constructor(slack, usersService, filesService) {
    this.usersService = usersService;
    this.filesService = filesService;

    slack.on('event', async (payload, client) => {
      this.client = client;

      console.log('Received event', payload.event.type);
      if (payload.event.type !== 'file_shared') {
        return;
      }

      if (payload.token !== process.env.SLACK_VERIFICATION_TOKEN) {
        console.error('Forbidden');
        return;
      }

      console.log('Processing payload', payload);
      const userData = await this.ensureUserExists(payload.event.user_id);
      const file = await this.getFile(payload.event.file_id);
      if (file.file.mimetype !== 'image/jpeg') {
        console.log('Unsupported mime type', file.file.mimetype);
        return;
      }

      const buffer = await this.loadFileContent(file);
      const exifData = await this.loadExifData(buffer);
      if (this.hasRequiredData(exifData)) {
        this.storeFile(file, exifData, userData);
      } else {
        console.log('Required EXIF data is missing')
      }
    });
  }

  async ensureUserExists(userId) {
    console.log('Loading user', userId);
    const user = await this.usersService.get(userId);
    if (!user) {
      console.log('User does not exist');

      let user;
      try {
        user = await this.client.send('users.info', {
          token: process.env.OAUTH_ACCESS_TOKEN,
          user: userId
        });
      } catch (e) {
        console.error('Unable to fetch user', e);
        throw e;
      }

      console.log('Loaded user data', user);

      const userData = {
        id: userId,
        username: user.user.name,
        fullName: user.user.real_name
      };

      console.log('Saving user data', userData);
      await this.usersService.put(userData);

      return userData;
    }

    return user;
  }

  async getFile(fileId) {
    console.log('Loading file', fileId);
    let file;
    try {
      file = await this.client.send('files.info', {
        token: process.env.OAUTH_ACCESS_TOKEN,
        file: fileId
      });
      console.log('Loaded file data', file);
    } catch (e) {
      console.error('Unable to fetch file', e);
      throw e;
    }

    return file;
  }

  async loadFileContent(file) {
    try {
      console.log('Downloading file from', file.file.url_private);
      return await this._request(file.file.url_private);
    } catch (e) {
      console.error('Unable to download file', e);
      throw e;
    }
  }

  loadExifData(buffer) {
    return new Promise(function (resolve, reject) {
      console.log('Loading EXIF data');
      new ExifImage({image: buffer}, function (error, exifData) {
        if (error) {
          console.error('Unable to load EXIF data', e);
          reject(error);
        } else {
          console.log('Loaded EXIF data', exifData);
          resolve(exifData);
        }
      });
    });
  }

  hasRequiredData(exifData) {
    return exifData.exif.CreateDate && exifData.gps.GPSLatitudeRef;
  }

  storeFile(file, exifData, user) {
    let lat = this._calculateDecimalCoordinate(exifData.gps.GPSLatitude, exifData.gps.GPSLatitudeRef);
    let lng = this._calculateDecimalCoordinate(exifData.gps.GPSLongitude, exifData.gps.GPSLongitudeRef);

    const fileData = {
      id: file.file.id,
      url: file.file.url_private,
      thumbnailUrl: file.file.thumb_80,
      createdAt: moment(exifData.exif.CreateDate, "YYYY:MM:DD").format('YYYY-MM-DD'),
      lat,
      lng,
      user
    };

    console.log('Saving file ', fileData);
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