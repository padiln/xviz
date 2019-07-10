// Copyright (c) 2019 Uber Technologies, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
/* eslint-disable camelcase, no-unused-vars */
import test from 'tape-catch';
import {XVIZJSONWriter, XVIZBinaryWriter, XVIZData, MemorySourceSink} from '@xviz/io';
import {loadProtos} from '@xviz/schema';

// All XVIZ messages
const XVIZ_PB = {
  ENVELOPE: 'xviz.v2.Envelope',
  START: 'xviz.v2.Start',
  TRANSFORM_LOG: 'xviz.v2.TransformLog',
  TRANSFORM_LOG_POINT_IN_TIME: 'xviz.v2.TransformPointInTime',
  TRANSFORM_LOG_DONE: 'xviz.v2.TransformLogDone',
  STATE_UPDATE: 'xviz.v2.StateUpdate',
  RECONFIGURE: 'xviz.v2.Reconfigure',
  METADATA: 'xviz.v2.Metadata',
  ERROR: 'xviz.v2.Error'
};

const pbTypes = loadProtos();
const pbEnvelope = pbTypes.lookupType(XVIZ_PB.ENVELOPE);
const pbMetadata = pbTypes.lookupType(XVIZ_PB.METADATA);
const pbStateUpdate = pbTypes.lookupType(XVIZ_PB.STATE_UPDATE);

//
//  Test data and cases for successful writer tests
//
const SAMPLE_METADATA = {
  version: '2.0',
  log_info: {
    start_time: 1,
    end_time: 2
  }
};

const SAMPLE_STATE_UPDATE = {
  updates: [
    {
      timestamp: 100
    }
  ]
};

test('XVIZProtobufWriter#validate', t => {
  t.equals(pbMetadata.verify(SAMPLE_METADATA), null, 'No error verifying metadata');
  t.equals(pbStateUpdate.verify(SAMPLE_STATE_UPDATE), null, 'No error verifying state_update');
  t.end();
});

const PRIMARY_POSE_STREAM = '/vehicle_pose';
const DEFAULT_POSE = {
  timestamp: 1.0,
  map_origin: {longitude: 1.1, latitude: 2.2, altitude: 3.3},
  position: [11, 22, 33],
  orientation: [0.11, 0.22, 0.33]
};

function makeFrame(points, colors) {
  return {
    update_type: 'snapshot',
    updates: [
      {
        timestamp: 1.0,
        poses: {
          [PRIMARY_POSE_STREAM]: DEFAULT_POSE
        },
        primitives: {
          '/test/points': {
            points: [
              {
                base: {
                  object_id: '1'
                },
                points,
                colors
              }
            ]
          }
        }
      }
    ]
  };
}

test.only('XVIZProtobufWriter#points', t => {
  const points_flat = [1, 1, 1, 2, 2, 2, 3, 3, 3];
  const colors_flat = [10, 10, 10, 255, 20, 20, 20, 255, 30, 30, 30, 255];

  const points_nested = [[1, 1, 1], [2, 2, 2], [3, 3, 3]];
  const colors_nested = [[10, 10, 10, 255], [20, 20, 20, 255], [30, 30, 30, 255]];

  const points_typed = Float32Array.from([1, 1, 1, 2, 2, 2, 3, 3, 3]);
  const colors_typed = Uint8Array.from([10, 10, 10, 255, 20, 20, 20, 255, 30, 30, 30, 255]);

  const points_typed_nested = [
    Float32Array.from([1, 1, 1]),
    Float32Array.from([2, 2, 2]),
    Float32Array.from([3, 3, 3])
  ];
  const colors_typed_nested = [
    Uint8Array.from([10, 10, 10, 255]),
    Uint8Array.from([20, 20, 20, 255]),
    Uint8Array.from([30, 30, 30, 255])
  ];

  // Generate a frame with specific points and colors
  [
    makeFrame(points_flat, colors_flat),
    makeFrame(points_nested, colors_nested),
    makeFrame(points_typed, colors_typed),
    makeFrame(points_typed_nested, colors_typed_nested)
  ].forEach(frame => {
    const neatObj = xvizConvertProtobuf(frame);
    const pbMsg = pbStateUpdate.fromObject(neatObj);
    const jsObj = pbStateUpdate.toObject(pbMsg, {
      enums: String
    });

    t.deepEquals(
      jsObj.updates[0].primitives['/test/points'].points[0].points,
      points_flat,
      'Points have been flattened, encoded, decode'
    );
    /*
    // Test that each "points" field is properly replaced.
    const sink = new MemorySourceSink();
    const writer = new XVIZBinaryWriter(sink);

    writer.writeMessage(0, frame);

    t.ok(sink.has('2-frame.glb'), 'wrote binary frame');

    const data = sink.readSync('2-frame.glb');
    const msg = new XVIZData(data).message();
    const writtenPoints = msg.data.updates[0].primitives['/test/points'].points[0];

    t.ok(writtenPoints.points, 'Has points');
    t.ok(writtenPoints.colors, 'Has colors');

    t.equals(writtenPoints.points[0], 1, 'point 1 matches input data');
    t.equals(writtenPoints.points[3], 2, 'point 2 matches input data');
    t.equals(writtenPoints.points[6], 3, 'point 3  matches input data');

    t.equals(writtenPoints.colors[0], 10, 'color 1 matches input data');
    t.equals(writtenPoints.colors[4], 20, 'color 2 matches input data');
    t.equals(writtenPoints.colors[8], 30, 'color 3 matches input data');
    */
  });
  t.end();
});

test('XVIZWriter#default-ctor', t => {
  /* eslint-disable no-unused-vars */
  // Ensure no parameter ctor
  const sink = new MemorySourceSink();
  const jsBuilder = new XVIZJSONWriter(sink);
  const binBuilder = new XVIZBinaryWriter(sink);
  t.end();
  /* eslint-enable no-unused-vars */
});

// Type m for metadata, f for message
const TestCases = [
  {
    name: 'envelope metadata',
    type: 'm',
    data: SAMPLE_METADATA
  },
  {
    name: 'message',
    type: 'f',
    data: SAMPLE_STATE_UPDATE
  },
  {
    name: 'message index',
    type: 'f',
    data: SAMPLE_STATE_UPDATE,
    postTest: (t, tc, writer, sink) => {
      writer.close();
      t.ok(sink.has('0-frame.json'), 'wrote index for messages');
      t.deepEquals(
        JSON.parse(sink.readSync('0-frame.json')),
        {
          timing: [[100, 100, 0, '2-frame']]
        },
        'json index matches expected'
      );
    }
  }
];

// Setup then test writing meta or message and validate output
function testWriter(t, testCase, Writer, suffix) {
  const sink = new MemorySourceSink();
  const writer = new Writer(sink, testCase.options);

  if (testCase.preTest) {
    testCase.preTest(t, testCase, writer, sink);
  }

  let lookup = null;
  let resultType = null;
  if (testCase.type === 'm') {
    lookup = '1-frame';
    resultType = 'metadata';
    writer.writeMetadata(testCase.data);
  } else if (testCase.type === 'f') {
    lookup = '2-frame';
    resultType = 'state_update';
    writer.writeMessage(0, testCase.data);
  } else {
    t.fail('Unknown testCase type');
  }

  t.ok(sink.has(`${lookup}.${suffix}`), `wrote json data ${lookup}.${suffix}`);
  const jsMessage = new XVIZData(sink.readSync(`${lookup}.${suffix}`)).message();
  t.deepEquals(jsMessage.data, testCase.data, 'data matches');
  t.deepEquals(jsMessage.type, resultType, 'type matches');

  if (testCase.postTest) {
    testCase.postTest(t, testCase, writer, sink);
  }
}

test('XVIZWriter#TestCases', t => {
  for (const testCase of TestCases) {
    t.comment(`-- TestCase: ${testCase.name}`);
    testWriter(t, testCase, XVIZJSONWriter, 'json');
    testWriter(t, testCase, XVIZBinaryWriter, 'glb');
  }
  t.end();
});

//
//  Test data and cases for throwing writer tests
//
const ThrowingTestCases = [
  {
    name: 'Missing updates',
    data: {},
    exceptionRegex: /Cannot find timestamp/,
    testMessage: 'Throws if missing updates'
  },
  {
    name: 'Updates missing timestamp',
    data: {
      updates: []
    },
    exceptionRegex: /XVIZ updates did not contain/,
    testMessage: 'Throws if updates missing timestamp'
  },
  {
    name: 'writeMessage after close',
    data: SAMPLE_STATE_UPDATE,
    preTest: (t, tc, writer, sink) => {
      writer.writeMessage(0, tc.data);
      writer.close();
    },
    exceptionRegex: /Cannot use this Writer after .close()/,
    testMessage: 'throws if writeMessage() called after close()'
  }
];

function testWriterThrows(t, testCase, Writer) {
  const sink = new MemorySourceSink();
  const writer = new Writer(sink, testCase.options);

  if (testCase.preTest) {
    testCase.preTest(t, testCase, writer, sink);
  }

  t.throws(
    () => writer.writeMessage(0, testCase.data),
    testCase.exceptionRegex,
    testCase.testMessage
  );

  if (testCase.postTest) {
    testCase.postTest(t, testCase, writer, sink);
  }
}

// Setup then test writing message that throws and validate output
test('XVIZWriter#ThrowingTestCases', t => {
  for (const testCase of ThrowingTestCases) {
    t.comment(`-- ThrowTestCase: ${testCase.name}`);
    testWriterThrows(t, testCase, XVIZJSONWriter, 'json');
    testWriterThrows(t, testCase, XVIZBinaryWriter, 'glb');
  }
  t.end();
});

test('XVIZWriter#default-ctor messages close()', t => {
  const sink = new MemorySourceSink();
  const jsBuilder = new XVIZJSONWriter(sink);
  const binBuilder = new XVIZBinaryWriter(sink);

  const data = SAMPLE_STATE_UPDATE;

  for (const builder of [jsBuilder, binBuilder]) {
    builder.writeMessage(0, data);
    builder.close();

    t.ok(sink.has('0-frame.json'), 'wrote index for messages');

    const expected = {
      timing: [[100, 100, 0, '2-frame']]
    };

    t.deepEquals(
      JSON.parse(sink.readSync('0-frame.json')),
      expected,
      'json index matches expected'
    );
  }

  t.end();
});

// Recursively walk object performing the following conversions
// - primitives with typed array fields are turned into arrays
// - primtives of type image have the data turned into a base64 string
/* eslint-disable complexity, no-else-return, max-statements */
export function xvizConvertProtobuf(object, keyName) {
  if (Array.isArray(object)) {
    if (!(keyName === 'vertices' || keyName === 'points' || keyName === 'colors')) {
      return object.map(element => xvizConvertProtobuf(element, keyName));
    }

    // Handle the following cases
    // [ [x, y, z], [x, y, z], ...]
    // [ TypedArray{x, y, z}, TypedArray{x, y ,z} ]
    // [ x, y, z, x, y, z, ... ]
    // [ {}, {}, ... ]
    if (Array.isArray(object[0])) {
      return object.reduce((arr, el) => arr.concat(el), []);
    } else if (ArrayBuffer.isView(object[0])) {
      return object.reduce((arr, el) => arr.concat(Array.from(el)), []);
    } else if (Number.isFinite(object[0])) {
      return object;
    } else if (typeof object[0] === 'object') {
      return object.map(element => xvizConvertProtobuf(element, keyName));
    }
  }

  // Typed arrays become normal arrays
  if (ArrayBuffer.isView(object)) {
    return Array.from(object);
  }

  if (object !== null && typeof object === 'object') {
    // Handle XVIZ Image Primitive
    const properties = Object.keys(object);
    if (properties.includes('data') && keyName === 'images') {
      // TODO: should verify it is a typed array and if not convert it to one
      return object;
    }

    // Handle all other objects
    const newObject = {};
    for (const key in object) {
      newObject[key] = xvizConvertProtobuf(object[key], key);
    }
    return newObject;
  }

  return object;
}
/* eslint-enable complexity */
