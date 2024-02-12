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
      const res = dynamodbDescribeTable(TABLE_NAME_CONST);
  
    //   const scanIterator = await dynamodbScanTable(TABLE_NAME_CONST, 5);
    //   console.log((await scanIterator.next()).value);
    //   console.log((await scanIterator.next()).value);
  
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
    //   'testMsg1'
    //   );
      
    const vendors = await getAllScanResults<Vendor>(
        process.env.AWS_VENDORS_TABLE_NAME ?? ''
      );
    
      const vendorIdList = vendors.map((item) => item.twitterId);
    
      const rules: Rule[] = [
        {
              value: `has:geo (from:${vendorIdList.join(` OR from:`)})`,
            // eg. "has:geo (from:vendor1 OR from:vendor2)"
          tag: 'vendors-geo',
        },
      ];
    // 意味着每当有符合这个规则的推文发布时，这些推文会实时被推送到你的应用程序中。
    
      await setRules(rules);
    };
    
    init();