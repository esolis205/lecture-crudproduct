import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

const REGION = 'us-west-2';
const ddbClient = new DynamoDBClient({ REGION });

export { ddbClient };
