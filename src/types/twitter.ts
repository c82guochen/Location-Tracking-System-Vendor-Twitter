export interface Rule {
    value: string;
    tag: string;
  }
  
  // 返回的数据是根据哪一条rule进行返回的
  export interface MatchingRule {
    value: string;
    tag: string;
  }
  
  export interface User {
    id: string;
    name: string;
    profile_image_url: string;
    username: string;
    verified: boolean;
    protected: boolean;
    created_at: string;
    description: string;
  }
  // location（也可用到其他服务上）
  export interface Place {
    id: string;
    name: string;
    place_type: string;
    country: string;
    country_code: string;
    full_name: string;
    geo: {
      type: string;
      bbox: number[];
      properties: any;
    };
  }
  
  // 记住这些个结构（在面试被问到设计的时候可以参考）
  export interface TweetRaw {
    author_id: string;
    created_at: string;
    id: string;
    lang: string; //language
    possibly_sensitive: boolean;
    reply_settings: string;
    source: string;
    text: string;
  }
  
  //对streaming里面的实时数据进行处理
  export interface TweetStream {
    includes: {
      places: Place[];
      users: User[];
      tweets: TweetRaw[];
      };
    // 符合什么样的条件才能把data发送过来
    matching_rules: MatchingRule[];
  }
  
  export interface Geotag {
    id: string;
    name: string;
    place_type: string;
    full_name: string;
    country: string;
    country_code: string;
    coordinates: {
      lat: number;
      long: number;
    };
  }
  
  export interface TweetFormatted {
    id: string;
    userId: string; // associate with twitter id in Vendor
    userName: string;
    text: string;
    date: string;
    geo: Geotag;
  }