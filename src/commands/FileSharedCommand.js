'use strict';

import request from 'request';
import {ExifImage} from 'exif';

export default class {
  constructor(slack, usersService) {
    this.usersService = usersService;
    slack.on('event', async (payload, client) => {
      this.client = client;

      console.log('Received event', payload.event.type);
      if (payload.event.type !== 'file_shared') {
        return;
      }

      console.log('Processing payload', payload);
      await this.ensureUserExists(payload.event.user_id);
      const file = await this.getFile(payload.event.file_id);
      if (file.file.mimetype !== 'image/jpeg') {
        console.log('Unsupported mime type', file.file.mimetype);
        return;
      }
      
      const exifData = await this.loadExifData(file);
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
      return this.usersService.put(userData);
    }
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

  async loadExifData(file) {
    let buffer;
    try {
      console.log('Downloading file from', file.file.url_private);
      buffer = await this._request(file.file.url_private);
    } catch (e) {
      console.error('Unable to download file', e);
      throw e;
    }

    try {
      console.log('Loading EXIF data');
      new ExifImage({image: buffer}, function (error, exifData) {
        if (error) {
          throw error;
        }
        else {
          console.log('Loaded EXIF data', exifData);
          return exifData;
        }
      });
    } catch (e) {
      console.error('Unable to load EXIF data', e);
      throw e;
    }

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