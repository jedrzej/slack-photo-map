'use strict';

export default class {
  constructor (slack) {
    slack.on('event', (payload, bot) => {
      if (payload.event.type !== 'file_shared') {
        return;
      }

      console.log(payload);
    });
  }
}