// cep.js
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////119:/
// SPIELWIESE - copy(l)eft 2022 - https://spielwiese.centra-dogma.at
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////119:/

"use strict";

import { SETTINGS, DEBUG, log_event } from './config.js';

import { Events        } from './events.js';
import { DomAssist     } from './dom_assist.js';
import { AutoWebSocket } from './websocket.js';
import { DebugTerminal } from './terminal/terminal.js';


export const ClientEndPoint = function (parameters = {}) {
	const self = this;
	self.templateName = 'ClientEndPoint';

	if (DEBUG.WINDOW_APP) window.CEP = self;

	this.events;
	this.connection;
	this.terminal;

	this.baseDir;      // Folder name of  index.html, eg. / or  /test/


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////119:/
// CONFIGURATION
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////119:/

	const EMITS_EVENTS = ['reload/client', 'reload/css'];


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////119:/
// INTERFACE
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////119:/

	this.connected = function () {
		return self.connection.connected();

	} // connected


	this.connect = function () {
		self.connection.connect();

	}; // connect


	this.disconnect = async function () {
		self.connection.disconnect();

	}; // connect


	this.send = function (request) {
		self.connection.send( request );

	};  // send


	this.toggleTerminal = async function () {
		if (!self.terminal) {
			self.terminal = await new DebugTerminal( self );
		} else {
			self.terminal.toggleVisibility();
		}

		return Promise.resolve();

	}; // toggleTerminal


// MODULES ///////////////////////////////////////////////////////////////////////////////////////////////////////119:/

	this.install = function (parameters) {
		if (self.terminal) self.terminal.installModule( parameters );

	}; // install

// HELPERS ///////////////////////////////////////////////////////////////////////////////////////////////////////119:/

	this.GET = new URLSearchParams( location.search.slice(1) );


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////119:/
// EVENTS
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////119:/

	this.onWsMessage = function (message) {
		if (message.broadcast && (message.broadcast.type == 'reload/client')) {
			let do_reload = false;
			Object.keys( message.broadcast.reload ).forEach( (file_name)=>{//...! change protocol
				file_name = file_name.replace( 'client/', '' );
				if (self.baseDir) file_name = file_name.replace( self.baseDir + '/', '' );
				if (file_name.slice(-4) == '.css') {
					const html
					= 'The file <a href="'
					+ file_name
					+ '">'
					+ file_name
					+ '</a> was reloaded'
					;

					self.events.emit( 'reload/css', html );
					self.dom.reloadCSS( file_name );
				}

				do_reload |= !(
					   (file_name.slice(-4) == '.css')
					|| (file_name.slice(-4) == '.txt')
					|| (file_name.slice(-4) == 'TODO')
					|| (file_name.slice(-6) == 'README')
				);
			});
			if (do_reload) {
				if (SETTINGS.RELOAD_ON_UPDATE) {
					self.events.emit( 'reload/client' );
					self.send( {chat:{say:'Reloading'}} );
					document.documentElement.classList.add( 'client_reload' );
					setTimeout( ()=>location.reload(), 333 );
				}
			}
		}

	}; // onWsMessage


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////119:/
// CONSTRUCTOR
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////119:/

	this.exit = function () {
		if (DEBUG.INSTANCES) console.log( 'ClientEndPoint.exit' );
		return Promise.resolve();

	}; // exit


	this.init = async function () {
		if (DEBUG.INSTANCES) console.log( 'ClientEndPoint.init' );

		self.baseDir = location.pathname.split( '/' ).slice( 0, -1 ).join( '/' );

		//init_event_listeners( parameters.events );
		self.events     = await new Events( self, EMITS_EVENTS, parameters.events );
		self.dom        = await new DomAssist( self );
		self.connection = await new AutoWebSocket( parameters.connection );

		self.connection.events.add( 'message', self.onWsMessage );

		document.documentElement.addEventListener( 'keydown', (event)=>{
			if ((event.key == 't') && !event.shiftKey && !event.ctrlKey && event.altKey) {
				event.preventDefault();
				self.toggleTerminal();
			}
		});

		if (self.GET.has('terminal')) await self.toggleTerminal();

		return Promise.resolve();

	}; // init


	return self.init().then( ()=>self );   // const cep = await new ClientEndPoint()

}; // ClientEndPoint


//EOF
