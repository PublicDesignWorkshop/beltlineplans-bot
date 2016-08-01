var request = require('request').defaults({ encoding: null });
var moment = require('moment');
var Twit = require('twit');
var accelaConfig = require('./accela-config.js');
var twitterConfig = require('./twitter-config.js');

console.log(Date());
var Bot = new Twit(twitterConfig);

var oauthOptions = {
  method: 'POST',
  url: 'https://apis.accela.com/oauth2/token',
  json: true,
  headers: {
    'content-type': 'application/x-www-form-urlencoded',
    'postman-token': 'ec06ed9b-fc6a-7390-994f-484e6b192319',
    'cache-control': 'no-cache'
  },
  form: accelaConfig
};

request(oauthOptions, function (error, response, body) {
  if (error) console.error('error getting access token', error);

  var accela_token = body.access_token;
  var yesterday = moment().subtract(1, 'days').format('YYYY-MM-DD') + ' 00:00:00';
  var today = moment().format('YYYY-MM-DD') + ' 00:00:00';

  var searchOptions = {
    method: 'POST',
    url: 'https://apis.accela.com/v4/search/records/',
    qs: { expand: 'addresses' },
    headers: {
      'postman-token': 'bae3fae3-45ad-5d31-0564-f7bd862da239',
       'cache-control': 'no-cache',
       'content-type': 'application/json',
       authorization:  accela_token
    },
    body: {
      address: { city: 'Atlanta' },
      type: { subType: 'Beltline' },
      openedDateFrom: yesterday,
      openedDateTo: today
    },
    json: true
  };

  request(searchOptions, function (error, response, body) {
    if (error) console.error('error making search', error);
    if (!body.result) {
      console.log('no search results');
      return; // no search results
    }
    
    for (var i = 0; i < body.result.length; i++) {
      var record = body.result[i];
      var address = record.addresses[0].streetStart + ' ' + record.addresses[0].streetName + ' ' + 
        (record.addresses[0].streetSuffix && record.addresses[0].streetSuffix.text ? record.addresses[0].streetSuffix.text : '');
      var description = record.description;
      console.log(record.id)
      var status = (description || '').replace(/^\s+|\s+$/g, ''); // trim whitespace
      if (status.length + address.length + ' : '.length <= 140) status += ((description ? ' : ' : '') + address);
      else if (status.length > 140) status = status.slice(0,137) + '...';
      console.log(status);
      staggerTweet(address, status, i * 1000 * 60 * 3);
    }
  });
});

function staggerTweet(street, status, delay) {
  setTimeout(function() { createTweet(street, status) }, delay);
}


function createTweet(street, status) {
  var location = encodeURI(street + ', Atlanta, GA');
  request.get('https://maps.googleapis.com/maps/api/streetview?size=600x400&location=' + location, function (error, response, body) {
    if (error) {
      console.error('error getting streetview image', error);
    } else {
      imageData = "data:" + response.headers["content-type"] + ";base64," + new Buffer(body).toString('base64');

      Bot.post('media/upload', { media_data: new Buffer(body).toString('base64') }, function (err, data, response) {
        if (err) console.error('error uploading image to Twitter', err);
        // now we can assign alt text to the media, for use by screen readers and 
        // other text-based presentations and interpreters 
        var mediaIdStr = data.media_id_string
        var meta_params = { media_id: mediaIdStr }
      

        Bot.post('media/metadata/create', meta_params, function (err, data, response) {
          if (err) {
            console.error('error creating metadata', err);
          } else {
            // now we can reference the media and post a tweet (media will attach to the tweet) 
            var params = { status: status, media_ids: [mediaIdStr] }
       
            Bot.post('statuses/update', params, function (err, data, response) {
              if (err) console.error('error tweeting', err);
              else console.log('done tweeting');
            });
          }
        })
      })
    }
  });
}