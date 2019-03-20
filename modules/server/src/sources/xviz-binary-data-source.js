const fs = require('fs');
const path = require('path');

import {XVIZData} from '@xviz/io';

const FRAME_DATA_SUFFIX = '-frame.glb';

// Support various formatted frame names
function getFrameName(index) {
  if (index === 0) {
    return `0-frame.json`;
  }

  return `${index}${FRAME_DATA_SUFFIX}`
}

function xvizPath(filepath, index) {
  return path.join(filepath, getFrameName(index));
}

export function makeBinaryDataSource(root, filepath, params) {
  // TODO: path may have a leading "/" beware of this
  const rootpath = path.join(root, filepath);
  console.log(`looking at ${xvizPath(rootpath, 1)}`);

  if (fs.existsSync(xvizPath(rootpath, 1))) {
    return new XVIZBinaryDataSource(rootpath);
  }

  return null;
}

function readJSON(filePath) {
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath));
  }

  return undefined;
}

// return bytearray or undefined
function readXVIZ(filePath) {
  if (fs.existsSync(filePath)) {
    return new XVIZData(fs.readFileSync(filePath));
  }

  return undefined;
}

class XVIZBinaryDataSource {
  constructor(root) {

    console.log('~~binary xviz source');
    this.root = root;
    this.indexFile = readJSON(xvizPath(this.root, 0));
    this.metadata = readXVIZ(xvizPath(this.root, 1));
  }

  // TODO
  // all async?
  // limits() for min/max time/frame
  // configuration(config) {}
  // reconfigure(config) {}
  // xvizFrameByTimestamp(timestamp|range) {}

  async xvizIndex() {
    return this.indexFile;
  }

  xvizMetadata() {
    return this.metadata;
  }

  getFrameRange(startTime, endTime) {
    let start = this.indexFile.start_timestamp;
    let end = this.indexFile.end_timestamp;

    // bounds check params
    if (startTime) {
      if (startTime >= start && startTime <= end) {
        start = startTime;
      }
    }

    if (endTime) {
      if (endTime >= start && endTime <= end) {
        end = endTime;
      } else {
        // todo: allow server duration limit
        end = start + 30;
      }
    }
    // todo: server limit on duration

    // Find indices based on time
    start = this.indexFile.timing.findIndex(timeEntry => start >= timeEntry[0]);
    if (start === -1) {
      start = 2;
    }

    end = this.indexFile.timing.findIndex(timeEntry => end >= timeEntry[1]);
    if (end === -1) {
      end = this.indexFile.timing.length;
    }

    return {start, end}
  }

  xvizFrameByIndex(index) { // |range
    return readXVIZ(xvizPath(this.root, index));
  }
};
