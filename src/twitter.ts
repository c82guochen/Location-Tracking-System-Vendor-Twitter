// 这里是开始研究twitter stream来实时传递数据
// The filtered stream endpoints deliver filtered Tweets to you in real-time that match on a set of rules that are applied to the stream.
// Rules are made up of operators that are used to match on a variety of Tweet attributes.

import needle from 'needle';
// 轻量级的 Node.js HTTP 客户端，常用于发送 HTTP 请求。
// 这个库提供了简洁的 API 来处理各种 HTTP 请求（如 GET, POST）和处理响应。
import dotenv from 'dotenv';
import { Rule, TweetFormatted, TweetStream } from './types/twitter';
import { dynamodbUpdateTweet, sqsSendMessage } from './aws';

dotenv.config();

// ENV
const TOKEN = process.env.TWITTER_API_BEARER_TOKEN ?? '';
const AWS_VENDORS_TABLE_NAME =
  process.env.AWS_VENDORS_TABLE_NAME ?? '';
const AWS_SQS_URL = process.env.AWS_SQS_URL ?? '';
// ?? 作用是：如果 process.env.TWITTER_API_BEARER_TOKEN 的值是 null 或 undefined，则使用 ''（空字符串）作为默认值。

// URLS（在twitter document里）
const RULES_URL =
    'https://api.twitter.com/2/tweets/search/stream/rules';
// RULES_URL是被第三方twitter API决定用来修改rules来获得filtered data的endpoint url
// 即rules是filter条件，表示从twitter拿来什么样的数据

// POST /2/tweets/search/stream/rules Add or delete rules to your twitter stream.
// Once you've added a rule or rules to your stream, 
// you can retrieve all of the Tweets that match these rules by using the GET /tweets/search/stream endpoint.

const STREAM_URL =
  'https://api.twitter.com/2/tweets/search/stream?tweet.fields=attachments,author_id,context_annotations,conversation_id,created_at,edit_controls,edit_history_tweet_ids,entities,geo,id,in_reply_to_user_id,lang,non_public_metrics,organic_metrics,possibly_sensitive,promoted_metrics,public_metrics,referenced_tweets,reply_settings,source,text,withheld&expansions=attachments.media_keys,attachments.poll_ids,author_id,edit_history_tweet_ids,entities.mentions.username,geo.place_id,in_reply_to_user_id,referenced_tweets.id,referenced_tweets.id.author_id&media.fields=alt_text,duration_ms,height,media_key,non_public_metrics,organic_metrics,preview_image_url,promoted_metrics,public_metrics,type,url,variants,width&poll.fields=duration_minutes,end_datetime,id,options,voting_status&user.fields=created_at,description,entities,id,location,name,pinned_tweet_id,profile_image_url,protected,public_metrics,url,username,verified,withheld&place.fields=contained_within,country,country_code,full_name,geo,id,name,place_type';

// Set rules for the Twitter stream
export const setRules = async (rules: Rule[]) => {
  try {
    console.log(TOKEN);
    const res = await needle(
      'post',
      RULES_URL,
      {
        add: rules,
      },
      {
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${TOKEN}`,
        },
      }
    );

    if (res.statusCode !== 201) {
      throw new Error(
        `setRules error response: ${res.statusCode} ${res.statusMessage}`
      );
    }

    console.log('Rules set!');
    return res.body;
  } catch (e) {
    if (e instanceof Error) {
      throw e;
    }
    throw new Error('setRules unexpected error');
  }
};

// Get rules
export const getAllRules = async () => {
  try {
    const res = await needle('get', RULES_URL, {
      headers: {
        authorization: `Bearer ${TOKEN}`,
      },
    });

    if (res.statusCode !== 200) {
      throw new Error(
        `getAllRules error response: ${res.statusCode} ${res.statusMessage}`
      );
    }

    return res.body;
  } catch (e) {
    if (e instanceof Error) {
      throw e;
    }
    throw new Error('getAllRules unexpected error');
  }
};

// Delete rules
export const deleteAllRules = async (rules: any) => {
  try {
    // 这里是因为matching rules一定要是Array
    if (!Array.isArray(rules.data)) {
      throw new Error('Invalid rules set passed in');
    }

    const ids = rules.data.map((item: any) => item.id);

    const params = {
      delete: {
        ids,
      },
    };

    const res = await needle('post', RULES_URL, params, {
      headers: {
        authorization: `Bearer ${TOKEN}`,
        'content-type': 'application/json',
      },
    });

    if (res.statusCode !== 200) {
      throw new Error(
        `deleteAllRules error response: ${res.statusCode} ${res.statusMessage}`
      );
    }

    return res.body;
  } catch (e) {
    if (e instanceof Error) {
      throw e;
    }
    throw new Error('deleteAllRules unexpected error');
  }
};

// Parse tweet
const parseTweet = (stream: TweetStream): TweetFormatted | Error => {
  try {
    // 每次connection sends out data wrapped in a array，也就是该array只包含有一个data
    //  如果多个用户同时发生变化，就会有多个array
    const user = stream.includes.users[0];
    const tweet = stream.includes.tweets[0];
    const place = stream.includes.places[0];

    
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
      return e;
    }

    throw new Error('parseTweet unexpected error');
  }
};

// Connect Stream
export const connectStream = (retryAttempt: number = 0) => {
  // 因为stream不是很好连接，所以用retryAttempt决定retry的次数
  const stream = needle.get(STREAM_URL, {
    headers: { authorization: `Bearer ${TOKEN}` },
    timeout: 20000,
  });

  // on是在这个streaming connect之后发生的事情
  // 需要monitor带data的字段
  stream
    .on('data', async (data) => {

      // 首先parse tweet
      try {
        // 将JSON格式字符串转换成JavaScript对象class。
        const json: TweetStream = JSON.parse(data);
        const parsedTweet = parseTweet(json);
        console.log('Tweet', parsedTweet);

        // Error handling first + Post-processing
        if (parsedTweet instanceof Error) {
          console.log('parseTweet error: ', parsedTweet.message);
        } else {
          // 如果取回了相关的数据，需要做两个步骤：更新数据库和发送信息

          // 1 - update the db
          const updatedTweetRes = await dynamodbUpdateTweet(
            AWS_VENDORS_TABLE_NAME,
            parsedTweet,
            parsedTweet.id
          );

          if (updatedTweetRes instanceof Error) {
            console.log(
              'dynamodbUpdateTweet error: ',
              updatedTweetRes.message
            );
          }

          // 2 - send to SQS
          const sqsRes = await sqsSendMessage(
            AWS_SQS_URL,
            JSON.stringify(parsedTweet)
          );

          if (sqsRes instanceof Error) {
            console.log('sqsSendMessage error: ', sqsRes.message);
          }
        }

        retryAttempt = 0; // After successfully connected, reset the counter
      } catch (e) {
        // 如果没有连接上就throw exception
        if (data.status === 401) {
          console.log('error status 401', data);
          throw new Error('Error status 401');
        } else if (
          data.detail ===
          'This stream is currently at the maximum allowed connection limit.'
        ) {
          console.log('error', data.detail);
          throw new Error('Stream max limit');
        } else {
          // Do nothing, keep alive signal
        }
      }
    })
    // 如果connect失败了，make another connect
    .on('err', (e) => {
      console.log('error on', e.message);
      if (e.code !== 'ECONNRESET') {
        console.log('invalid error code', e.code);
        throw new Error('Invalid error code');
      } else {
        console.log(
          'Twitter connection failed trying again, attempt: ',
          retryAttempt
        );
        setTimeout(() => {
          connectStream(++retryAttempt);
        }, 2 ** retryAttempt); // Exponential Backoff
      }
    });

  return stream;
};

// stream vendors
export const streamVendors = async (vendorList: String[]) => {
  try {
    const currentRules = await getAllRules();
    // Get current rule firstly, if there is a rule already existed, we need to delete it.
    // 因为不想特意分出一个表来存储它,而且rule需要唯一
    if (currentRules.hasOwnProperty('data')) {
      await deleteAllRules(currentRules);
    }

    connectStream();
    // 这个是异步的，所以一定会发生在下一行的定义rule之后
    
    const rules: Rule[] = [
    // 重新定义一下rule
      {
        value: `has:geo (from:${vendorList.join(' OR from')})`,
        tag: 'vendors-geo',
      },
    ];

    await setRules(rules);
  } catch (e) {
    if (e instanceof Error) {
      throw e;
    }

    throw new Error('streamVendors unexpected error');
  }
};