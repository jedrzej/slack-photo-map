'use strict';

import Logger from '../utils/Logger';

const logger = new Logger('FileUnsharedCommand');

export default class {
  constructor(slack, filesService) {
    this.filesService = filesService;

    slack.on('event', (payload, client) => {
      if (payload.token !== process.env.SLACK_VERIFICATION_TOKEN) {
        logger.error('Forbidden');
        client.replyPrivate('Whoops! There\'s been an error!');
        return;
      }

      this.client = client;

      try {
        this.handleEvent(payload)
      } catch (e) {
        logger.error('ERROR', e.message);
        client.replyPrivate('Whoops! There\'s been an error!');
      }
    });
  }

  async handleEvent(payload) {
    logger.debug('Received event', payload.event.type);

    if (payload.event.type !== 'file_unshared' && payload.event.type !== 'file_deleted') {
      logger.debug('Unsupported event');
      return;
    }

    logger.debug('Processing payload', payload);

    if (await this.filesService.get(payload.event.file_id)) {
      logger.debug('Deleting file', payload.event.file_id);
      await this.filesService.delete(payload.event.file_id);
      logger.debug('File deleted');
    } else {
      logger.error('File not found', payload.event.file_id);
    }
  }
}