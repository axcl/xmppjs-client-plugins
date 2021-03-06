'use strict';

const {EventEmitter} = require('@xmpp/events');
const xml = require('@xmpp/xml');

const IBBNS = 'http://jabber.org/protocol/ibb';

class IBBPlugin extends EventEmitter {
	constructor(client) {
		super();
		this.iqCallee = client.iqCallee;
		this.iqCaller = client.iqCaller;
		this.init();
	}

	init() {
		this.iqCallee.set(IBBNS, 'open', ctx => {
			return true;
		});
		this.iqCallee.set(IBBNS, 'data', ctx => {
			this.handleIBBData(ctx);
			return true;
		});
	}

	sendSessionRequest(from, to, id, sid, blockSize) {
		const ibbreq = xml(
			'iq',
			{ type: 'set', to, id, from },
			xml('open', {
				'xmlns': IBBNS,
				'block-size': blockSize,
				sid,
				'stanza': 'iq',
			}),
		);
		return this.iqCaller
			.request(ibbreq);
	}

	sendByteStream(from, to, id, sid, rid, blockSize, data, messageGroup, comment) {
		return this.sendSessionRequest(from, to, rid, sid, blockSize).then((res) => {
			const { from: From, id: ID, type } = res.attrs;
			if (From === to && rid === ID && type === 'result') {
				return this.sendData(from, to, id, sid, data, messageGroup, comment);
			}
			throw res;

		});
	}

	sendData(from, to, id, sid, data, messageGroup, comment) {
		return this.iqCaller
			.request(
				xml(
					'iq',
					{ type: 'set', to, id, from },
					xml('data', {
						'xmlns': IBBNS,
						'seq': '0',
						sid,
						'imgcomment': comment, // custom atribute
						'imggroupid': messageGroup, // custom atribute
						// TODO: See if there is a better way to pass custom data
						// custom xml element is the suggested way, but does not work with iq, unlike message
					}, data),
				)
			);
	}
	// TODO: Implement Closing the Bytestream

	handleIBBData({stanza}) {
		const { from } = stanza.attrs;
		const data = stanza.getChild('data');
		const { seq, imgcomment, imggroupid } = data.attrs;
		this.emit('IBBSuccess', {
			data: data.text(),
			from,
			seq,
			imgcomment,
			imggroupid,
		});
	}

	sendClose() {
	}

	receiveClose() {
	}
}

/**
 * Register a ibb plugin.
 *
 * @param {Client} client XMPP client instance
 * @returns {IBBPlugin} Plugin instance
 */

function setupIBB(client) {
	return new IBBPlugin(client);
}

module.exports = setupIBB;
