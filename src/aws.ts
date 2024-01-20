import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import AWS from 'aws-sdk';
import dotenv from 'dotenv';
import { TweetFormatted, TweetStream } from './types/twitter';

dotenv.config();
// 加载 .env 文件中定义的环境变量到 process.env，这使得在代码中可以方便地使用这些变量。
// 通常，.env 文件用于存储敏感信息和配置选项，如数据库密码、API 密钥等，因此它不应该被添加到版本控制系统（如 Git）中。
// process.env 是 Node.js 中的一个全局对象，用于存储关于系统环境的信息。
//  它是 process 对象的一个属性，其中包含了环境变量的键值对。

AWS.config.update({ region: process.env.AWS_REGION });
// 使用 AWS SDK 的 config.update 方法来配置 AWS 的默认区域。
// process.env.AWS_REGION 是一个环境变量，表示 AWS 的区域（例如，us-west-2、eu-central-1 等）。
// 这个值应该在.env 文件中被定义，如 AWS_REGION = us - west - 2

const { DynamoDB, SQS } = AWS;
// 使用对象解构，从 AWS 对象中提取 DynamoDB 和 SQS 模块。
const dynamodb = new DynamoDB();
const sqs = new SQS();

// 1 - Describe a table
export const dynamodbDescribeTable = async (tableName: string) => {
  try {
    const res = await dynamodb
      .describeTable({ TableName: tableName })
      .promise();
    console.log('Table retrieved', res);
    return res;
  } catch (e) {
    if (e instanceof Error) {
      return e;
    }
    console.error(e);
    throw new Error('dynamodbDescribeTable error');
  }
};

// 2 - Scan method
// 这里的function*是指该函数为generator，允许函数按需生成一系列值，而不是一次性返回一个单一值。
    // 因此需要搭配yield实现
export const dynamodbScanTable = async function* (
  tableName: string,
  limit: number = 25,
  // 上一次被retrieve的最后一个object（是为了方便分页）
    lastEvaluatedKey?: AWS.DynamoDB.Key
  // 这里加问号是因为该变量不是必要的
) {
  while (true) {
    const params: AWS.DynamoDB.ScanInput = {
      TableName: tableName,
      Limit: limit,
    };

    if (lastEvaluatedKey) {
      // 检查 lastEvaluatedKey 是否存在
      params.ExclusiveStartKey = lastEvaluatedKey;
      // 如果存在，表明之前的 Scan 或 Query 操作没有检索到表中的所有数据，而是返回了一个 LastEvaluatedKey。
      // 将 lastEvaluatedKey 赋值给 params.ExclusiveStartKey，代码设置了 Scan 或 Query 请求的起始点
    }
    //如果 lastEvaluatedKey 不存在，说明没有之前的检索操作，或者前一次检索已经到达了数据集的末尾。

    try {
      const result = await dynamodb.scan(params).promise();
      if (!result.Count) {
        // result.Count是 scan 操作返回的对象中的一个属性，表示检索到的项的数量。
        return; //如果为0的话，就直接return，意为到了表底，退出循环
      }
      // (result as AWS.DynamoDB.ScanOutput)是一个 TypeScript 类型断言。
      // 它告诉 TypeScript 编译器：“我知道 result 对象是 AWS.DynamoDB.ScanOutput 类型”。
      // 类型断言不会在 JavaScript 运行时改变任何值，它只在 TypeScript 编译过程中使用，用于提供类型信息。
      lastEvaluatedKey = (result as AWS.DynamoDB.ScanOutput)
        .LastEvaluatedKey;
      // .LastEvaluatedKey是 ScanOutput 类型对象中的一个属性，
      // 包含了执行 scan 操作时 DynamoDB 返回的最后一个处理的项的键。
      // 如果 LastEvaluatedKey 存在，您可以在随后的 scan 操作中将其用作 ExclusiveStartKey，以继续从上次停止的地方检索更多的数据。
      result.Items = result.Items?.map((item) => unmarshall(item));
      // result.Items是 scan 操作返回的对象中的一个属性，它包含一个数组，每个元素都是一个检索到的 DynamoDB 项。
      // result.Items?.map(...): 这是一个可选链（Optional Chaining）操作符跟着的 map 函数调用。可选链操作符 ?. 允许您安全地读取 Items 属性，即使 Items 不存在或者为 null/undefined 也不会抛出错误。如果 Items 是真实存在的数组，map 函数将被调用
      // map((item) => unmarshall(item)): map 函数会遍历 Items 数组中的每一个项，并且对每个项调用 unmarshall 函数。unmarshall 函数将每个 DynamoDB 项的格式转换为普通的 JavaScript 对象。
      
      // 和generator function* 相搭配，返回当前批次25个条目
      yield result;
    } catch (e) {
      if (e instanceof Error) {
        throw e;
      }
      throw new Error('dynamodbScanTable error');
    }
  }
};

// 3 - Get All Scan Results
export const getAllScanResults = async <T>(
  // 意思是泛型异步函数，<T> 表示它可以处理不同类型的返回结果。
    tableName: string,
    limit: number = 25
  ) => {
    try {
      await dynamodbDescribeTable(tableName);
      // 确认指定的 DynamoDB 表是否存在。
      const scanTableGen = await dynamodbScanTable(tableName, limit);
      // 这里的T代表泛型，因为原本的result作为被返回的结果类型不明确，用T表示
      const res: T[] = [];
      // T[]:指明 res 是一个数组，数组中的元素类型为 T。这里T是一个泛型参数，表示数组可以包含任何类型的元素。
      // 泛型在 TypeScript 中用于增加函数或类的灵活性，允许在保留类型安全的同时重用代码。
      // = []初始化 res 为一个空数组。由于类型注解 T[]，这个空数组将被视为一个包含类型 T 元素的数组。
  
      let isDone = false;
  
        while (!isDone) { 
        // next  instead of calling the function dynamodbScanTable
        const iterator = await scanTableGen.next();
        // 调用 scanTableGen.next() 将执行生成器函数的下一次迭代，返回一个包含当前批次数据的对象（iterator）。
        if (!iterator) {
          throw new Error('No iterator returned');
        }
  
          if (iterator.done || !iterator.value.LastEvaluatedKey) {
            // iterator.done 是一个布尔值，当生成器完成所有迭代时为 true。
            // !iterator.value.LastEvaluatedKey 检查 DynamoDB 返回的最后一个评估键是否存在。如果不存在，表示没有更多的数据可以检索。
            // 该项为True的情况有两种，已到达数据集末尾或者数据集小于单次检索限制
            isDone = true;
        }
  
          if (iterator.value) {
            // iterator.value 包含了当前批次的 DynamoDB 数据。
            // iterator.value.Items! 是当前批次的数据项数组。感叹号 (!) 是 TypeScript 的非空断言操作符，用于告诉编译器 Items 属性是存在的。
          iterator.value.Items!.forEach((item: any) => res.push(item));
        } 
      }
  
      return res;
    } catch (e) {
      if (e instanceof Error) {
        throw e;
      }
      throw new Error('getAllScanResults unexpected error');
    }
};
  
// 4 - Update Tweet field
export const dynamodbUpdateTweet = async (
    tableName: string,
    tweet: TweetFormatted,
    twitterId: string
  ) => {
    try {
      const params: AWS.DynamoDB.UpdateItemInput = {
        TableName: tableName,
        Key: marshall({ twitterId: twitterId }),
        // { "twitterId": { "S": "someTwitterIdValue" } }
        UpdateExpression:
          // set: 这是 DynamoDB 更新表达式的关键字，用于指示要更新或添加的属性。
          // #tweets: 这是一个表达式属性名。在 DynamoDB 的表达式中，# 前缀用于属性名的占位符，以避免与 DynamoDB 的保留关键字冲突。实际的属性名在 ExpressionAttributeNames 中定义，这里 #tweets 对应于表中的 tweets 属性。
          // list_append(...): 这个函数用于将一个项（或多个项）附加到一个现有的列表类型的属性上。如果该属性不存在，将创建一个新列表。
          // if_not_exists(#tweets, :empty_list): 这是一个条件函数，用于检查 tweets 属性是否存在。如果 tweets 存在，则返回其值；如果不存在，则返回 :empty_list（这里是一个空列表）。
          // :tweet: 这是一个表达式属性值的占位符，用于在表达式中引用一个值。实际的值在 ExpressionAttributeValues 中定义。这里 :tweet 对应于要追加到 tweets 列表中的新推文。
          'set #tweets = list_append(if_not_exists(#tweets, :empty_list), :tweet), #updated = :updated',
        ExpressionAttributeNames: {
          '#tweets': 'tweets',
          '#updated': 'updated',
        },
        ExpressionAttributeValues: marshall({
          // 在 DynamoDB 的 UpdateExpression 中使用 ExpressionAttributeValues 时，
          // 给 tweet 加入方括号 [] 是为了将单个 tweet 对象封装成一个数组。
          // 因为 list_append 函数期望它的参数是两个列表（数组），并将第二个列表中的元素追加到第一个列表的末尾。
          ':tweet': [tweet],
          ':updated': Date.now(),
          ':empty_list': [],
        }),
      };
  
      const result = await dynamodb.updateItem(params).promise();
      console.log('Tweet added to record!');
      return result;
    } catch (e) {
      if (e instanceof Error) {
        throw e;
      }
      throw new Error('dynamodbUpdateTweet error object unknown type');
    }
  };

  // 5 - SQS message
export const sqsSendMessage = async (
  // 异步函数 sqsSendMessage，用于向 AWS Simple Queue Service (SQS) 队列发送消息。
  // 接受两个参数：队列的 URL(queueUrl) 和要发送的消息内容(body)。
    queueUrl: string,
    body: string
  ) => {
    try {
      const params: AWS.SQS.SendMessageRequest = {
        MessageBody: body,
        QueueUrl: queueUrl,
      };
  
      const res = await sqs.sendMessage(params).promise();
      console.log('Send Message!');
      return res;
    } catch (e) {
      if (e instanceof Error) {
        throw e;
      }
      throw new Error('sqsSendMessage error object unknown type');
    }
};
  
// 6 - Parse tweet
const parseTweet = (stream: TweetStream): TweetFormatted | Error => {
  try {
    const user = stream.includes.users[0];
    const tweet = stream.includes.tweets[0];
    const place = stream.includes.places[0];
    // 进行数据的拼接
    return {
      id: tweet.id,
      userName: user.name,
      userId: user.username,
      text: tweet.text,
      date: tweet.created_at,
      geo: {
        id: place.id,
        name: place.name,
        full_name: place.full_name,
        place_type: place.place_type,
        country: place.country,
        country_code: place.country_code,
        coordinates: {
          long: place.geo.bbox[0],
          lat: place.geo.bbox[1],
        },
      },
    };
  } catch (e) {
    if (e instanceof Error) {
      throw e;
    }

    throw new Error('parseTweet unexpected error');
  }
};