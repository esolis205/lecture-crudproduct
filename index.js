// With ES6 and NodeJS 16.x ++
    // We are able to use export const handler
        // Instead of exports.handler

import { DeleteItemCommand, GetItemCommand, PutItemCommand, QueryCommand, ScanCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { v4 as uuidv4 } from 'uuid'
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { ddbClient } from "./ddbClient.js";
import { GET, POST, DELETE, PUT } from "./utils/constants.js";

export const handler = async function(event) {
    console.log("request:", JSON.stringify(event, undefined, 2));
    let body;
    try {
        switch (event.httpMethod) {
            case GET: {
                if (event.queryStringParameters != null){
                    body = await getProductsByCategory(event);
                }
                else if(event.pathParameters != null){
                    body = await getProduct(event.pathParameters.id);
                } 
                else {
                    body = await getAllProducts(event);
                }
            }
                break;
            case POST:
                body = await createProduct(event)
                break;
            case DELETE:
                body = await deleteProduct(event.pathParameters.id);
                break;
            case PUT:
                body = await updateProduct(event);
                break;
            default: 
                throw new Error(`Unsupported route ${event.httpMethod}`);
        }

        // When working with lambda functions, the response must always include statusCode: number, and body: string.
        console.log(body);
        return {
            statusCode: 200,
            body: JSON.stringify({
                message: `Successfully finished operation: "${event.httpMethod}"`,
                body: body,
            }) 
        }

    } catch (e) {
        console.log(e)
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: "Failed to perform operation.",
                errorMsg: e.message,
                errorStack: e.stack
            }) 
        }
    }

}

const getProduct = async (productId) => {
    console.log("getProduct");

    // Marshall and UnMarshall - Applying key operations without supplying any data types.

    try {
        const params = {
            TableName: process.env.DYNAMODB_TABLE_NAME,
            Key: marshall({ id: productId })
        };

        const { Item } = await ddbClient.send(new GetItemCommand(params));

        console.log(Item);  
        return (Item) ? unmarshall(Item) : {};
    } catch (e) {
        console.error(e);
        throw e;
    }
}

const getAllProducts = async (productId) => {
    console.log("getAllProducts")

    try {
        const params = {
            TableName: process.env.DYNAMODB_TABLE_NAME,
            Key: marshall({ id: productId })
        }

        const { Items } = await ddbClient.send(new ScanCommand(params));

        console.log(Items);
        return (Items) ? Items.map((item) => unmarshall(item)) : {};
    } catch (e) { 
        console.error(e);
        throw e;
    }
}

const createProduct = async (event) => {
    try {
        console.log(`createProduct function. event : "${event}"`)

        const productRequest = JSON.parse(event.body);
        // Use uuid to generate random product id's
        const productId = uuidv4();
        productRequest.id = productId;

        const params = {
            TableName: process.env.DYNAMODB_TABLE_NAME,
            Item: marshall(productRequest || {})
            /** If not using marshel operations, must specify whole JSON object
             * Item: {
             * CUSTROMER_ID: { N: "001" },
             * CUSTOMER_NAME: { S: "Richard Roe" },
             * }
             */
        };

        const createResult = await ddbClient.send(new PutItemCommand(params));
        console.log(createResult)

        return createResult;
    } catch (e) {
        console.error(e)
        throw e;
    }
}

const deleteProduct = async (productId) => {
    try {
        console.log(`deleteProduct function, productId : "${productId}"`)

        const params = {
            TableName: process.env.DYNAMODB_TABLE_NAME,
            Key: marshall({ id: productId })
        };
        const deleteResult = await ddbClient.send(new DeleteItemCommand(params));

        console.log(deleteResult);
        return deleteResult;
    } catch (e) {
        console.error(e)
        throw e;
    }
}

const updateProduct = async (event) => {
    try {
        const requestBody = JSON.parse(event.body);
        const objKeys = Object.keys(requestBody);
        console.log(`updateProduct function. requestBody : "${requestBody}" and objKeys: "${objKeys}"`);


        const params = {
            TableName: process.env.DYNAMODB_TABLE_NAME,
            Key: marshall({ id: event.pathParameters.id }),
            UpdateExpression: `Set ${objKeys.map((_, index) => `#key${index} = :value${index}`).join()}`,
            ExpressionAttributeNames: objKeys.reduce((acc, key, index) => ({
                ...acc,
                [`#key${index}`]: key
            }), {}),
            ExpressionAttributeValues: marshall(objKeys.reduce((acc, key, index) => ({
                ...acc,
                [`:value${index}`]: requestBody[key]
            }), {})),
        };
        const updateResult = await ddbClient.send(new UpdateItemCommand(params));

        console.log(updateResult);
        return (updateResult) ? unmarshall(updateResult) : {};
    } catch (e) {
        console.error(e)
        throw e;
    }
}

const getProductsByCategory = async (event) => {
    console.log("getProductsByCategoryId");
    try {
        const productId = event.pathParameters.id;
        const category = event.queryStringParameters.category;

        const params = {
            KeyConditionExpression: "id = :productId",
            FilterExpression: "contains (category, :category)",
            ExpressionAttributeValues: {
                ":productId": { S: productId },
                ":category": { S: category }
            },
            TableName: process.env.DYNAMODB_TABLE_NAME
        };

        const { Items } = await ddbClient.send(new QueryCommand(params));

        console.log(Items)
        return Items.map((item) => unmarshall(item));
    } catch (e) {
        console.error(e)
        throw e;
    }
}