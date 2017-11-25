'use strict';

export function handler(event, context, callback) {
  const body = JSON.parse(event.body);
  console.log("BODY\n", body);

  if (body.token !== process.env.SLACK_VERIFICATION_TOKEN) {
    console.log("FORBIDDEN");
    return callback(null, {
      statusCode: 403,
      body: 'Forbidden'
    });
  }

  const response = {
    statusCode: 200,
    body: 'OK'
  };

  console.log("RESPONSE\n", response);
  callback(null, response);
}