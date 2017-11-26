'use strict';

import AWS from 'aws-sdk';
import DynamoDBService from './services/DynamoDBService';

const dynamoDbClient = new AWS.DynamoDB.DocumentClient();
const filesService = new DynamoDBService(dynamoDbClient, process.env.FILES_TABLE_NAME);

export async function main(event, context, callback) {
  const files = await filesService.index();

  const response = {
    statusCode: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Credentials": true
    },
    body: JSON.stringify(files)
  };

  callback(null, response);
}

