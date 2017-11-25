'use strict';

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
}