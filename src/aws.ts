import { unmarshall } from '@aws-sdk/util-dynamodb';
import AWS from 'aws-sdk';
import dotenv from 'dotenv';

dotenv.config();
// 加载 .env 文件中定义的环境变量到 process.env，这使得在代码中可以方便地使用这些变量。
// 通常，.env 文件用于存储敏感信息和配置选项，如数据库密码、API 密钥等，因此它不应该被添加到版本控制系统（如 Git）中。
// process.env 是 Node.js 中的一个全局对象，用于存储关于系统环境的信息。
//  它是 process 对象的一个属性，其中包含了环境变量的键值对。

AWS.config.update({ region: process.env.AWS_REGION });
// 使用 AWS SDK 的 config.update 方法来配置 AWS 的默认区域。
// process.env.AWS_REGION 是一个环境变量，表示 AWS 的区域（例如，us-west-2、eu-central-1 等）。
// 这个值应该在.env 文件中被定义，如 AWS_REGION = us - west - 2

const { DynamoDB } = AWS;

const dynamodb = new DynamoDB();

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
export const dynamodbScanTable = async function* (
  // 这里的function*是指该函数为generator，允许函数按需生成一系列值，而不是一次性返回一个单一值。
  // 因此需要搭配yield实现 
  tableName: string,
  limit: number = 25,
  lastEvaluatedKey?: AWS.DynamoDB.Key
  // 上一次被retrieve的最后一个object（是为了方便分页）
  // 这里加问号是因为该变量不是必要的
) {
  while (true) {
    const params: AWS.DynamoDB.ScanInput = {
      TableName: tableName,
      Limit: limit,
    };

    if (lastEvaluatedKey) {
      params.ExclusiveStartKey = lastEvaluatedKey;
      // 如果lastEvaluatedKey存在，表明之前的 Scan 或 Query 操作没有检索到表中的所有数据，而是返回了一个 LastEvaluatedKey。
      // 将 lastEvaluatedKey 赋值给 params.ExclusiveStartKey，代码设置了 Scan 或 Query 请求的起始点
    }
    //如果 lastEvaluatedKey 不存在，说明没有之前的检索操作，或者前一次检索已经到达了数据集的末尾。

    try {
      const result = await dynamodb.scan(params).promise();
      if (!result.Count) {
        // result.Count是 scan 操作返回的对象中的一个属性，表示检索到的项的数量。
        return; //如果为0的话，就直接return，意为到了表底，退出循环
      }

      lastEvaluatedKey = (result as AWS.DynamoDB.ScanOutput)
        .LastEvaluatedKey;
      // 如果 LastEvaluatedKey 存在，您可以在随后的 scan 操作中将其用作 ExclusiveStartKey，以继续从上次停止的地方检索更多的数据。

      result.Items = result.Items?.map((item) => unmarshall(item));
      // map 函数会遍历 Items 数组中的每一个项，并且对每个项调用 unmarshall 函数。unmarshall 函数将每个 DynamoDB 项的格式转换为普通的 JavaScript 对象。

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
  // 是泛型异步函数，<T> 表示它可以处理不同类型的返回结果。
  // 此处指该函数将返回一个 Promise<T> 类型的对象
  tableName: string,
  limit: number = 25
) => {
  try {
    await dynamodbDescribeTable(tableName);
    // 确认指定的 DynamoDB 表是否存在。
    const scanTableGen = await dynamodbScanTable(tableName, limit);
    
    // 这里的T代表泛型，因为原本的result作为被返回的结果类型不明确，用T表示
    const res: T[] = [];
    // T[]:指明 res 是一个数组，数组中的元素类型为 T。
    // = []初始化 res 为一个空数组。由于类型注解 T[]，这个空数组将被视为一个包含类型 T 元素的数组。

    let isDone = false;

    while (!isDone) {
      // use .next to call the function* generator
      const iterator = await scanTableGen.next();

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
        // iterator.value.Items! 是当前批次的数据项数组。
        // 感叹号(!) 是 TypeScript 的非空断言操作符，用于告诉编译器 Items 属性是存在的。
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