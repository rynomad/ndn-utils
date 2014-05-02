var utils = {}
  , ndn = require('ndn-lib')
var Data = ndn.Data
var Name = ndn.Name
var SignedInfo = ndn.SignedInfo
var ndnbuf = ndn.customBuffer
var DataUtils = ndn.DataUtils

utils.chunkArbitraryData = function(opts) {
  var ndnArray = [];
  //console.log(name)
  if (opts.type == 'object') {
    var string = JSON.stringify(opts.thing);
  }
  var name = new ndn.Name(opts.uri)
  if (opts.version != false) {
    utils.appendVersion(name, opts.version)
  }
  var stringArray = string.match(/.{1,1300}/g);
  var segmentNames = [];
  for (i = 0; i < stringArray.length; i++) {
    segmentNames[i] = new Name(name).appendSegment(i)
    var co = new Data(segmentNames[i], new SignedInfo(), stringArray[i]);
    co.signedInfo.setFields()
    co.signedInfo.finalBlockID = utils.initSegment(stringArray.length - 1)

    if (opts.freshness != undefined) {
      co.signedInfo.setFreshnessPeriod(opts.freshness)
    }
    co.sign()
    ndnArray[i] = co.wireEncode()
  };

  return {array:ndnArray, name: name};

};

utils.initSegment = function(seg) {
    if (seg == null || seg == 0)
	  return (new ndnbuf('00', 'hex'));

    var segStr = seg.toString(16);

    if (segStr.length % 2 == 1)
	segStr = '0' + segStr;

    segStr = '00' + segStr;
    return (new ndnbuf(segStr, 'hex'));
};

utils.getAllPrefixes = function(name) {
  var uriArray = [];
  for (i = 0 ; i < name.components.length + 1 ; i++) {
    var uri = name.getPrefix(i).toUri()
    uriArray.push(uri);
  };
  return uriArray;
};

utils.isFirstSegment = function(name) {
    return name.components != null && name.components.length >= 1 &&
        name.components[name.components.length - 1].value.length == 1 &&
        name.components[name.components.length - 1].value[0] == 0;
};

utils.isLastSegment = function(name, co) {

    return DataUtils.arraysEqual(name.components[name.components.length - 1].value, co.signedInfo.finalBlockID);
}

utils.normalizeUri = function(name) {
  //console.log(name)
  if (!endsWithSegmentNumber(name)) {
    normalizedName = name;
    requestedSegment = 0
  } else if (!isFirstSegment(name)) {
    normalizedName = name.getPrefix(name.components.length - 1);
    requestedSegment = DataUtils.bigEndianToUnsignedInt(name.components[name.components.length - 1].value);
  } else {
    normalizedName = name.getPrefix(name.components.length - 1) ;
    requestedSegment = 0;
  };
  var returns = [normalizedName, requestedSegment];
  return returns;
};

utils.getSegmentInteger = function(name) {
  if (name.components != null && name.components.length >= 1 &&
  name.components[name.components.length - 1].value.length >= 1 &&
  name.components[name.components.length - 1].value[0] == 0) {
    return DataUtils.bigEndianToUnsignedInt(name.components[name.components.length - 1].value)
  } else {
    return 0;
  }
};

utils.normalizeNameToObjectStore = function(name) {
  var throwaway = utils.getNameWithoutCommandMarker(name);

  if (!utils.endsWithSegmentNumber(throwaway)) {
    return throwaway.appendSegment(0).toUri();
  } else if (!utils.isFirstSegment(throwaway)) {
    return throwaway.getPrefix(name.components.length - 1).appendSegment(0).toUri();
  } else {
    return throwaway.toUri();
  };
};

utils.endsWithSegmentNumber = function(name) {
    return name.components != null && name.components.length >= 1 &&
        name.components[name.components.length - 1].value.length >= 1 &&
        name.components[name.components.length - 1].value[0] == 0;
}

utils.nameHasCommandMarker = function(name) {
  for (var i = name.size() - 1; i >= 0; --i) {
    var component = name.components[i].getValue();
    if (component.length <= 0)
      continue;

    if (component[0] == 0xC1) {
      return true
    };
  }

  return false;
};

utils.getCommandMarker = function(name) {
  //console.log(name)
  for (var i = name.size() - 1; i >= 0; --i) {
    var component = name.components[i].getValue();
    if (component.length <= 0)
      continue;

    if (component[0] == 0xC1 && component[2] != 0x4E) {
      return name.components[i].toEscapedString()
    };
  }
};

utils.getNameWithoutCommandMarker = function(name) {
  var strippedName = new Name('');

  for (var i = 0 ; i < name.size(); i++) {
    var component = name.components[i].getValue();
    if (component.length <= 0)
      continue;

    if (component[0] != 0xC1) {
      strippedName.append(name.components[i]);
    };
  };
  return strippedName;
};


utils.getSuffix = function(name, p) {
    return new Name(name.components.slice(p));
};

utils.appendVersion = function(name, date) {
    console.log(date)
    if (date) {
      if (date instanceof Date) {
        var d = date.getTime()

      } else if (typeof date == "number")
        var d = new Date().setTime(date)
    } else {
      var d = new Date().getTime();
    };

    var time = d.toString(16);
    if (time.length % 2 == 1) {
	    time = '0' + time;
    };
    time = 'fd' + time;
    var binTime = new ndnbuf(time, 'hex');
    //console.log(binTime)
    return name.append(binTime);
};

utils.timeToVersion = function(date) {
  if (date instanceof Date) {
    var d = date.getTime
  } else {
    var d = date;
  };
  var time = d.toString(16);
  if (time.length % 2 == 1) {
    time = '0' + time;
  };
  time = 'fd' + time;
  var binTime = new ndnbuf(time, 'hex');
  return (new Name.Component(binTime).toEscapedString())

};

utils.versionToTime = function(version) {
  time = 0
  array = DataUtils.toNumbers(DataUtils.toHex(version))
  //console.log(array)
  for (i = 1; i < array.length ; i++) {
    time = time + (array[i] * Math.pow(2, (7 - i)));
    //console.log(time)
  };
  return time
};



utils.setNonce = function(interest) {
  var bytes = [0xc1, 0x2e, 0x4e, 0x00];
  for (var n = 8; n > 0; n--) {
	  bytes.push(Math.floor(Math.random() * 256));
	  //console.log(bytes)
  }
  var buf = new ndnbuf(bytes);
  interest.nonce = buf;
}

module.exports = utils;
