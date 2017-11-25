'use strict';

export default class {
  constructor (documentClient, tableName) {
    this.db = documentClient;
    this.tableName = tableName;
  }

  get (id) {
    const params = {
      TableName: this.tableName,
      Key: {
        id
      }
    };

    return this.db
      .get(params)
      .promise()
      .then(data => data.Item);
  }

  index (extraParams) {
    const params = {
      TableName: this.tableName,
      ...extraParams
    };

    return this.db
      .scan(params)
      .promise()
      .then(data => data.Items);
  }

  put (Item) {
    if (!Item.id) {
      return Promise.reject('Item.id is not defined!');
    }

    const params = {
      TableName: this.tableName,
      Item
    };

    return this.db.put(params).promise().then(() => Item);
  }

  update (id, UpdateExpression, ExpressionAttributeValues, ConditionExpression) {
    const params = {
      TableName: this.tableName,
      ReturnValues: 'ALL_NEW',
      Key: {
        id
      },
      UpdateExpression,
      ExpressionAttributeValues,
      ConditionExpression
    };

    return this.db.update(params).promise();
  }

  delete (id) {
    const params = {
      TableName: this.tableName,
      Key: {
        id
      }
    };

    return this.db.delete(params).promise();
  }
}