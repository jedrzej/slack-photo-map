'use strict';

export default class {
  constructor(slack, filesService) {
    this.filesService = filesService;

    slack.on('event', async (payload, client) => {
      this.client = client;

      console.log('Received event', payload.event.type);
      if (payload.event.type !== 'file_unshared' && payload.event.type !== 'file_deleted') {
        return;
      }

      console.log('Processing payload', payload);

      if (await this.filesService.get(payload.event.file_id)) {
        console.log('Deleting file', payload.event.file_id);
        await this.filesService.delete(payload.event.file_id);
        console.log('File deleted');
      } else {
        console.error('File not found', payload.event.file_id);
      }
    });
  }
}