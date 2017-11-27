'use strict';

import Logger from '../utils/Logger';

export default class {
  constructor(slack, filesService) {
    this.filesService = filesService;
    this.logger = new Logger('FileUnsharedCommand');

    slack.on('event', async (payload, client) => {
      this.client = client;

      this.logger.log('Received event', payload.event.type);
      if (payload.event.type !== 'file_unshared' && payload.event.type !== 'file_deleted') {
        this.logger.log('Unsupported event');
        return;
      }

      if (payload.token !== process.env.SLACK_VERIFICATION_TOKEN) {
        this.logger.error('Forbidden');
        return;
      }

      this.logger.log('Processing payload', payload);

      if (await this.filesService.get(payload.event.file_id)) {
        this.logger.log('Deleting file', payload.event.file_id);
        await this.filesService.delete(payload.event.file_id);
        this.logger.log('File deleted');
      } else {
        this.logger.error('File not found', payload.event.file_id);
      }
    });
  }
}