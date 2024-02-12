// 这里是开始研究twitter stream来实时传递数据
// The filtered stream endpoints deliver filtered Tweets to you in real-time that match on a set of rules that are applied to the stream.
// Rules are made up of operators that are used to match on a variety of Tweet attributes.

import needle from 'needle';
// 轻量级的 Node.js HTTP 客户端，常用于发送 HTTP 请求。
// 这个库提供了简洁的 API 来处理各种 HTTP 请求（如 GET, POST）和处理响应。
import dotenv from 'dotenv';
import { Rule } from './types/twitter';

dotenv.config();

// ENV
const TOKEN = process.env.TWITTER_API_BEARER_TOKEN ?? '';
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