import { dynamodbDescribeTable, dynamodbScanTable } from './aws';

const init = async () => {
  const TABLE_NAME_CONST = 'vendors';
  const res = await dynamodbDescribeTable(TABLE_NAME_CONST);

    const scanIterator = await dynamodbScanTable(TABLE_NAME_CONST, 5);
    let data = await scanIterator.next();
    console.log('1-5', data.value,data.done);
    data = await scanIterator.next();
    console.log('6-10', data.value, data.done);
    data = await scanIterator.next();
    console.log('11-15', data.value, data.done);
    data = await scanIterator.next();
    console.log('15-19', data.value, data.done);
    data = await scanIterator.next();
    console.log('?-?', data.value,data.done);
};

init();