import {
  dynamodbDescribeTable,
  dynamodbScanTable,
  getAllScanResults,
  dynamodbUpdateTweet,
  sqsSendMessage,
} from './aws';
import dotenv from 'dotenv';
import { Vendor } from './types/vendor';
import { Rule } from './types/twitter';
import { setRules } from './twitter';

dotenv.config();

const init = async () => {
  const TABLE_NAME_CONST = 'vendors';
  // const res = await dynamodbDescribeTable(TABLE_NAME_CONST);
  // console.log(res);

    // const scanIterator = await dynamodbScanTable(TABLE_NAME_CONST, 5);
    // console.log((await scanIterator.next()).value);
    // console.log((await scanIterator.next()).value);
    // console.log((await scanIterator.next()).value);
    // const fourthPart = (await scanIterator.next());
    // console.log(fourthPart.value, fourthPart.done);
    // const fifthPart = (await scanIterator.next());
  //   console.log(fifthPart.value);
  
  //   const vendors = await getAllScanResults<Vendor>(
  //     process.env.AWS_VENDORS_TABLE_NAME ?? ''
  //   );
  //   console.log(vendors);

  // await dynamodbUpdateTweet(
  //   process.env.AWS_VENDORS_TABLE_NAME ?? '',
  //   {
  //     id: 'tweet1',
  //     userId: 'DCTacoTruck',
  //     userName: 'DC Taco Truck',
  //     text: 'Test tweet',
  //     date: '09/12/23',
  //     geo: {
  //       id: 'geo1',
  //       name: 'Geo location 1',
  //       place_type: 'place 1',
  //       full_name: 'place 1',
  //       country: 'USA',
  //       country_code: 'USA',
  //       coordinates: {
  //         lat: 34.01283,
  //         long: 41.1818,
  //       },
  //     },
  //   },
  //   'DCTacoTruck'
  // );

  // await sqsSendMessage(
  //   'https://sqs.us-east-1.amazonaws.com/656203730697/MyQueue',
  //      'testMsg1'
  // );

  // 使用async函数getAllScanResults从某个数据源（可能是AWS）获取所有扫描结果。
  const vendors = await getAllScanResults<Vendor>(
    process.env.AWS_VENDORS_TABLE_NAME ?? ''
  );
  // 遍历vendors数组，并从每个项目中提取twitterId属性，生成一个新的数组vendorIdList。
  const vendorIdList = vendors.map((item) => item.twitterId);

  // When an activity is delivered through your filtered stream connection, 
  // in a matching_rules array, it contains which list of filters matched against the Tweet delivered.
  // value属性是一个字符串，通过将vendorIdList中的所有Twitter ID用“OR”连接起来构成了一个查询表达式。
  // 这个表达式可能用于搜索具有地理位置信息的推文，且这些推文是由列表中的Twitter ID所发出的。
  const rules: Rule[] = [
    {

      // 在Twitter API中，from:操作符是一个独立的、基本的操作符，用于匹配来自特定用户的推文。使用这个操作符时，可以指定用户的用户名（不包括@字符）或用户的数字ID。每次使用from:操作符只能指定一个用户名或ID。
      // vendorIdList 是一个数组，.join( OR from:) 方法会将数组中的所有元素用 ' OR from:' 这个字符串连接起来。
      // 这意味着如果 vendorIdList 是 ['id1', 'id2', 'id3']，vendorIdList.join(' OR from:') 会生成 'id1 OR from:id2 OR from:id3'。
      value: `has:geo (from:${vendorIdList.join(` OR from:`)})`,
      // 为啥这么说是信息变化了推动给我？？？？ 
      tag: 'vendors-geo',          
    },
  ];

  // 应用上面定义的规则。
  await setRules(rules);
};

init();