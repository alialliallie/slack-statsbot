// TODO this should probably be further decomposed
// Also should maybe just return a reply which the bot actually sends?

var find = require('lodash.find');
var UpdateParser = require('./update-parser');

class DirectMessageHandler {
  constructor(userRepository) {
    this.userRepository = userRepository;
  }

  handle(channel, message) {
    var text = message.text.toLowerCase();

    if (text === 'info') {
      this.handleInformationRequest(channel, message);
    } else if (text === 'help') {
      this.handleHelpRequest(channel, message);
    } else {
      this.handleInformationUpdate(channel, message);
    }
  }

  handleInformationRequest(channel, message) {
    // FIXME fetch the entire user rather than run multiple queries
    Promise.all([
        this.userRepository.retrieveAttribute(message.user, 'isMan'),
        this.userRepository.retrieveAttribute(message.user, 'isPersonOfColour')
    ]).then(function(attributes) {
      // var [isMan, isPersonOfColour] = attributes;
      // TODO use destructuring assignment
      var isMan = attributes[0];
      var isPersonOfColour = attributes[1];

      var reply;

      if ((isMan === null || isMan === undefined) &&
          (isPersonOfColour === null || isPersonOfColour === undefined)) {
        reply = `We don’t have you on record! ${DirectMessageHandler.HELP_MESSAGE}`;
      } else {
        var genderReply;
        var raceReply;

        reply = 'Our records indicate that:\n\n';

        var attributeValues = {
          'manness': isMan,
          'pocness': isPersonOfColour
        };

        [DirectMessageHandler.MANNESS_CONFIGURATION, DirectMessageHandler.POCNESS_CONFIGURATION].forEach(function(attributeConfiguration) {
          var value = attributeValues[attributeConfiguration.name];

          var valueConfiguration = find(attributeConfiguration.values, function(valueConfiguration) {
            return valueConfiguration.value == value;
          });

          if (valueConfiguration) {
            reply += `* ${valueConfiguration.texts.information}\n`;
          } else {
            reply += `* ${attributeConfiguration.unknownValue.texts.information}\n`;
          }
        });
      }

      channel.send(reply);
    });
  }

  handleInformationUpdate(channel, message) {
    var isMan = new UpdateParser(DirectMessageHandler.MANNESS_CONFIGURATION, message.text).parse();
    var isPersonOfColour = new UpdateParser(DirectMessageHandler.POCNESS_CONFIGURATION, message.text).parse();

    if (isMan !== undefined) {
      this.handleGenderUpdate(channel, message.user, isMan);
    } else if (isPersonOfColour !== undefined) {
      this.handleRaceUpdate(channel, message.user, isPersonOfColour);
    } else {
      channel.send(`I’m sorry, I’m not that advanced and I didn’t understand your message. ${DirectMessageHandler.HELP_MESSAGE}`);
    }
  }

  handleGenderUpdate(channel, userID, isMan) {
    this.handleAttributeUpdate(
      channel,
      userID,
      'isMan',
      isMan,
      DirectMessageHandler.MANNESS_CONFIGURATION
    );
  }

  handleRaceUpdate(channel, userID, isPersonOfColour) {
    this.handleAttributeUpdate(
      channel,
      userID,
      'isPersonOfColour',
      isPersonOfColour,
      DirectMessageHandler.POCNESS_CONFIGURATION
    );
  }

  handleAttributeUpdate(channel, userID, attributeName, value, attributeConfiguration) {
    var reply;
    this.userRepository.storeAttribute(userID, attributeName, value);

    var matchingValue = find(attributeConfiguration.values, function(configurationValue) {
      return configurationValue.value === value;
    });

    if (matchingValue) {
      reply = matchingValue.texts.update;
    }

    channel.send(reply);
  }

  handleHelpRequest(channel, message) {
    channel.send(DirectMessageHandler.VERBOSE_HELP_MESSAGE);
  }
}

// TODO maybe messages should be collected somewhere central, and parameterised

DirectMessageHandler.HELP_MESSAGE = 'You can let me know “I’m not a man” or “I am a person of colour” and other such variations, or ask for my current information on you with “info”.';
DirectMessageHandler.VERBOSE_HELP_MESSAGE = `Hey, I’m a bot that collects statistics on who is taking up space in the channels I’m in. For now, I only track whether or not a participant is a man and/or a person of colour. ${DirectMessageHandler.HELP_MESSAGE}`;

DirectMessageHandler.MANNESS_CONFIGURATION = {
  name: 'manness',
  values: [
    {
      value: true,
      matcherSets: [
        [{matches: 'true'}],
        [{matches: 'man'}, {doesNotMatch: 'not'}]
      ],
      texts: {
        information: 'you are a man',
        update: 'Okay, we have noted that you are a man. If I got it wrong, try saying “I am *not* a man!”'
      }
    },
    {
      value: false,
      matcherSets: [
        [{matches: 'false'}],
        [{matches: 'man'}, {matches: 'not'}]
      ],
      texts: {
        information: 'you are not a man',
        update: 'Okay, we have noted that you are not a man. If I got it wrong, try saying “I am a man”.'
      }
    }
  ],
  unknownValue: {
    texts: {
      information: 'we have no information on whether or not you are a man'
    }
  }
};

DirectMessageHandler.POCNESS_CONFIGURATION = {
  name: 'pocness',
  values: [
    {
      value: true,
      matcherSets: [
        [{matches: 'person of colou?r'}, {doesNotMatch: 'not'}],
        [{matches: 'white'}, {matches: 'not'}]
      ],
      texts: {
        information: 'you are a person of colour',
        update: 'We have noted that you are a person of colour. If I got it wrong, try saying “I am not a person of colour”'
      }
    },
    {
      value: false,
      matcherSets: [
        [{matches: 'person of colou?r'}, {matches: 'not'}],
        [{matches: 'white'}, {doesNotMatch: 'not'}]
      ],
      texts: {
        information: 'you are not a person of colour',
        update: 'We have noted that you are not a person of colour. If I got it wrong, try saying “I am a person of colour”'
      }
    }
  ],
  unknownValue: {
    texts: {
      information: 'we have no information on whether or not you are a person of colour'
    }
  }
};

module.exports = DirectMessageHandler;
