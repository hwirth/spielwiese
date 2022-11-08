// router.js
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////119:/
// SPIELWIESE - WEBSOCKET SERVER - copy(l)eft 2022 - https://spielwiese.central-dogma.at
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////119:/

"use strict";

const { SETTINGS        } = require( '../server/config.js' );
const { DEBUG, COLORS   } = require( '../server/debug.js' );
const { color_log, dump } = require( '../server/debug.js' );
const { REASONS         } = require( './constants.js' );


const WebSocketClient = require( './client.js' );


module.exports.Router = function (persistent, callback) {
	const self = this;

	this.protocols;


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////119:/
// HELPERS
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////119:/

	function log_persistent (event_name, caption = '') {
		if (DEBUG.ROUTER_PERSISTENT_DATA) color_log(
			COLORS.ROUTER,
			'Router.' + event_name + ':',
			caption + 'persistent:',
			persistent, //.clients,
		);

	} // log_persistent


	function send_as_json (socket, data) {
		const stringified_json = JSON.stringify( data, null, '\t' );

		if (DEBUG.MESSAGE_OUT) color_log(
			COLORS.ROUTER,
			'Router-send_as_json:',
			JSON.parse( stringified_json ),
		);

		//...if (DEBUG.MESSAGE_OUT) color_log( COLORS.ROUTER, 'send_as_json:', data );
		if (socket.send) socket.send( stringified_json );

	} // send_as_json //... Redundant with same function in  SessionHandler()


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////119:/
// INTERFACE
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////119:/

	this.onConnect = function (socket, client_address) {
		//...if (DEBUG.CONNECT) color_log( COLORS.ROUTER, 'Router.onConnect:', client_address );

		self.protocols.session.onConnect( socket, client_address );   // Will create new WebSocketClient()

		log_persistent( 'onConnect' );

	}; // onConnect


	this.onDisconnect = function (socket, client_address) {
		//...if (DEBUG.DISCONNECT) color_log( COLORS.ROUTER, 'Router.onDisconnect:', client_address );

		self.protocols.session.onDisconnect( socket, client_address );

		log_persistent( 'onDisconnect' );

	}; // onDisconnect


	function create_command_lut () {
		const lut = {};

		Object.keys( self.protocols ).forEach( (protocol_name)=>{
			const protocol_commands = self.protocols[protocol_name].request;

			if (protocol_commands) {
				Object.keys( protocol_commands ).forEach( (command_name)=>{
					const combined = protocol_name + '.' + command_name;
					lut[combined] = protocol_commands[command_name];
				});
			}
		});

		return lut;
	}


	this.onMessage = async function (socket, client_address, message) {
		const request_id = message;

		const client = self.protocols.session.getClientByAddress( client_address );
		if (!client) {
			color_log( COLORS.ERROR, 'ERROR', 'Router.onMessage: Unknown client:', client_address );
			callback.broadcast({ 'ROUTER ERROR 0': 'Unknown client in onMessage' });
			return;
		}

		function send_error (error) {
			if (typeof error != 'error') {
				const report = error.stack.replace( new RegExp(SETTINGS.BASE_DIR, 'g'), '' );
				callback.broadcast({ 'ROUTER ERROR 1': report });

				return;
			}

			const report = error.stack.replace( new RegExp(SETTINGS.BASE_DIR, 'g'), '' );
			const new_message = {
				tag      : request_id.tag,
				success  : false,
				reason   : REASONS.INTERNAL_ERROR,
			};

			if (client.login && client.inGroup( 'admin', 'dev' )) {
				color_log( COLORS.ERROR, 'ERROR Router.onMessage:1' );
				new_message.response = report;
			} else {
				color_log( COLORS.ERROR, 'ERROR Router.onMessage:2:', error );
			}

			//...send_as_json( socket, new_message );
			callback.broadcast({ 'ROUTER ERROR 2': new_message });
		}


		const command_lut = create_command_lut();

		const handled_commands = [];
		const rejected_commands = [];

		async function call_request_handler (protocol_name, command_name) {
			const combined_name = protocol_name + '.' + command_name;
			const request_handler = self.protocols[protocol_name].request[command_name];

			if (!request_handler) {
				rejected_commands.push( combined_name );

				if (DEBUG.ROUTER) color_log(
					COLORS.ERROR,
					'Router.onMessage:',
					'unknown command:',
					combined_name,
				);

			} else {
				handled_commands.push( combined_name );

				if (DEBUG.ROUTER) color_log(
					COLORS.ROUTER,
					'Router.onMessage:',
					'request_handler: ',
					request_handler,
				);

				log_persistent( 'onMessage:', 'PRE COMMAND: ' );

				const request_arguments = message[ protocol_name ][ command_name ];

				try {
					//... How do I catch, when I accidentially
					//... forgot to await something in there?
					if (request_handler.constructor.name === 'AsyncFunction') {
						if (DEBUG.ROUTER) color_log( COLORS.ROUTER, 'AWAIT:', combined_name );
						await request_handler(
							client,
							request_id,
							request_arguments

						).catch( (error)=>{
							const report = error.stack.replace(
								new RegExp( SETTINGS.BASE_DIR, 'g' ),
								'',
							);
							send_error( error );
						});

					} else {
						if (DEBUG.ROUTER) color_log( COLORS.ROUTER, 'SYNC', combined_name );
						try {
							request_handler(
								client,
								request_id,
								request_arguments,
							);

						} catch (error) {
							send_error( error );
						}
					}

				} catch (error) {
					const report = error.replace(
						new RegExp( SETTINGS.BASE_DIR, 'g' ),
						'',
					);
					send_error( error );
				}

				log_persistent( 'onMessage:', 'POST COMMAND: ' );
			}

		} // call_request_handler


		// A message can have several protocol requests.
		// JSON format: { <protocol>: { <command>: { <request> }}}
		// Main level keys designate target protocol, second level a command
		// Since keys in objects must be unique, each command can only be used once

		const addressed_protocols = Object.entries( message );

		const requests_processed
		= addressed_protocols
		.filter( ([protocol_name]) => protocol_name != 'tag' )
		.map( async ([protocol_name, protocol_command_names]) => {
			const protocol = self.protocols[protocol_name];

			if (!protocol) {
				rejected_commands.push( protocol_name );

				if (DEBUG.ROUTER) color_log(
					COLORS.WARNING,
					'Router.onMessage:',
					'unknown protocol:',
					protocol_name,
				);

			} else {
				if (DEBUG.ROUTER) color_log(
					COLORS.ROUTER,
					'Router.onMessage:',
					'protocol_commands:',
					Object.keys( message[protocol_name] ),
				);

				if (protocol.onMessage) {
					protocol.onMessage( socket, client_address, message );
				}

				const commands = Object.keys( protocol_command_names );
				await commands.reduce( async (prev, command_name)=>{
					// Enforce execution order on second level (commands)
					await prev;
					return call_request_handler(protocol_name, command_name);
				}, Promise.resolve());
			}

			return Promise.resolve();

		})/*.reduce( async (prev, next)=>{
			// Enforce execution order on top level (protocols)
			await prev;
			return next;
		})*/;

		await Promise.allSettled( requests_processed );

		if (rejected_commands.length) color_log(
			COLORS.ROUTER,
			'Router.onMessage:',
			(rejected_commands.length ? COLORS.ERROR : COLORS.DEFAULT)
			+ 'Commands handled/rejected:'
			+ COLORS.DEFAULT
			, handled_commands.length
			, '/'
			, rejected_commands.length
		);

		const debug_message = { protocols: {} };
		if (handled_commands .length) debug_message.protocols.handled  = handled_commands;
		if (rejected_commands.length) debug_message.protocols.rejected = rejected_commands;
		if (rejected_commands.length) send_as_json( socket, debug_message );

	}; // onMessage


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////119:/
// CONSTRUCTOR
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////119:/

	this.exit = function () {
		if (DEBUG.INSTANCES) color_log( COLORS.INSTANCES, 'Router.exit' );

		return Promise.allSettled(
			Object.keys( self.protocols ).map( (name)=>{
				return (
					self.protocols[name].exit
					? self.protocols[name].exit()
					: Promise.resolve()
				);
			}),
		);

	}; // exit


	this.init = async function () {
		if (DEBUG.INSTANCES) color_log( COLORS.INSTANCES, 'Router.init' );

		self.protocols = {};

// PROTOCOL INTERFACE ////////////////////////////////////////////////////////////////////////////////////////////119:/
		const SessionHandler = require( './session.js' );
		const AccessControl  = require( './access.js' );
		const MasterControl  = require( './mcp/main.js' );
		const ChatServer     = require( './chat/main.js' );

		const registered_callbacks = {
			reset                  : callback.reset,
			triggerExit            : callback.triggerExit,
			getProtocols           : ()=>self.protocols,
			getAllClients          : ()=>{ return persistent.session.clients; },
			getAllPersistentData   : ()=>{ return persistent; },
			getProtocolDescription : (show_line_numbers)=>{
				return self.protocols.access
				.getProtocolDescription( show_line_numbers );//...?
			},
		};

		const registered_protocols = {
			session : { template: SessionHandler,
				callbacks: [
					'getAllClients',
				],
			},
			access  : { template: AccessControl },

			//...mcp    : { template: MasterControl, callbacks: Object.keys(registered_callbacks) },
			mcp     : { template: MasterControl,
				callbacks : [
					'reset',
					'getUpTime',
					'getProtocols',
					'getAllPersistentData',
					'getProtocolDescription',
					'triggerExit',
				],
			},
			chat    : { template: ChatServer,
				callbacks : [
					'getAllClients',
				],
			},
		};
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////119:/

		const load_requests = Object.keys( registered_protocols ).map( async (protocol_name)=>{
			if (!persistent[protocol_name]) {
				color_log( COLORS.PROTOCOL, 'No persistent data for protocol:', protocol_name );
				persistent[protocol_name] = {};
			}

			const protocol  = registered_protocols[protocol_name];
			const data      = persistent[protocol_name];

			const new_callbacks = {};
			if (protocol.callbacks) protocol.callbacks.forEach( (name)=>{
				new_callbacks[name] = registered_callbacks[name];
			});

			self.protocols[protocol_name] =
				await new protocol.template( data, new_callbacks );
		});

		await Promise.all( load_requests );

		color_log( COLORS.ROUTER, 'Protocols:', Object.keys(self.protocols) );

		return Promise.resolve();

	}; // init


	return self.init().then( ()=>self );   // const router = await new Router();

}; // Router


//EOF
