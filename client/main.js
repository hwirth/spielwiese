// client: main.js
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////119:/
// SPIELWIESE - copy(l)eft 2022 - https://spielwiese.centra-dogma.at
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////119:/

"use strict";

import { SETTINGS, DEBUG } from './config.js';
import { WebSocketClient } from './websocket.js';
import { DebugConsole    } from './debug_console.js';


const Application = function () {
	const app = self = this;

	this.webSocketClient;
	this.terminal;
	this.youTubePlayer;

	const boot_sequence = false && [
		{
			session: {
				login: {
					username : 'root',
					password : '12345',
				},
			},
		},

	]; // boot_sequence


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////119:/
// HELPERS
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////119:/

	async function connect_to_websocket (ws_url = SETTINGS.WEBSOCKET.URL) {
		if (self.webSocketClient) {
			await disconnect_from_websocket( self.webSocketClient );
		}

		self.webSocketClient = await new WebSocketClient({
			url    : ws_url,
			events : {
				onOpen    : on_websocket_open,
				onClose   : on_websocket_close,
				onMessage : on_websocket_message,
				onError   : on_websocket_error,
			},
			terminal: self.terminal,
		});

		return Promise.resolve();

	} // connect_to_websocket


	function disconnect_from_websocket (websocket) {
		return self.webSocketClient.exit().then( ()=>self.webSocketClient = null );

	} // disconnect_from_websocket


	function random_video_id () {
		return SETTINGS.YOUTUBE.VIDEO_IDS[
			Math.floor( Math.random() * SETTINGS.YOUTUBE.VIDEO_IDS.length )
		];

	} // random_video_id()


// YouTube ///////////////////////////////////////////////////////////////////////////////////////////////////////119:/

	function random_video_id () {
		return SETTINGS.YOUTUBE.VIDEO_IDS[
			Math.floor( Math.random() * SETTINGS.YOUTUBE.VIDEO_IDS.length )
		];

	} // random_video_id

	this.toggleYouTubePlay = function () {
		if (self.youTubePlayer === null) {
			self.youTubePlayer = new YouTubePlayer( self, self.dom.divYouTube, random_video_id() );
		} else {
			self.youTubePlayer.togglePlayer();
		}

	}; // toggleYouTubePlay


	this.toggleYouTubePause = function () {
		if (self.youTubePlayer === null) {
			self.youTubePlayer = new YouTubePlayer( self, self.dom.divYouTube, random_video_id() );
		} else {
			self.youTubePlayer.togglePause();
		}

	}; // toggleYouTubePause


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////119:/
// EVENTS
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////119:/

	function on_websocket_open (event, socket)  {
		self.terminal.print( 'Connected to ' + SETTINGS.WEBSOCKET.URL, 'cep' );
		self.terminal.onSocketOpen();

		if (boot_sequence) boot_sequence.forEach( (request)=>{
			socket.send( request );
		});

	} // on_websocket_open


	function on_websocket_close (event, socket)  {
		self.terminal.print( 'Connection lost', 'cep' );
		self.terminal.onSocketClose();

	} // on_websocket_close


	function on_websocket_message (event, socket, message) {
		self.terminal.onReceive( message );

	} // on_websocket_message


	function on_websocket_error (event, socket) {
		self.terminal.print( 'Connection error', 'cep' );
		self.terminal.onSocketError();

	} // on_websocket_error


	function on_console_send (request) {
		self.webSocketClient.send( request );

	} // on_console_send


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////119:/
// CONSTRUCTOR
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////119:/

	this.exit = function () {
		return Promise.resolve();

	}; // exit


	this.init = async function () {
		console.log( 'Application.init' );

		self.youTubePlayer = null;

		document.body.innerHTML += (`
		`);

		self.webSocketClient = null;

		self.terminal = await new DebugConsole({
			getWebSocketClient : ()=>{ return self.webSocketClient; },
			isConnected        : ()=>{ return self.webSocketClient && self.webSocketClient.isConnected(); },
			connect            : connect_to_websocket,
			disconnect         : disconnect_from_websocket,
			send               : on_console_send,
		});

		if (boot_sequence) boot_sequence.forEach( (request)=>{
			self.terminal.history.add( self.terminal.requestToText(request) );
		});

		if (SETTINGS.CONNECT_ON_START) {
			show_status( 'Connecting' );
			connect_to_websocket();
		}

		//...const prefers_dark_scheme = window.matchMedia( '(prefers-color-scheme:dark)' );
		//...document.body.classList.toggle( 'dark_mode', prefers_dark_scheme.matches );

		return Promise.resolve();

	}; // init


	return self.init().catch( watchdog ).then( ()=>self );   // const app = await new Application()

}; // Application



//////////////////////////////////////////////////////////////////////////////////////////////////////////////////119:/
// PROGRAM ENTRY POINT
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////119:/
/*
addEventListener( 'error', reboot );
addEventListener( 'unhandledrejection', reboot );
function reboot (error) {
	console.log( error );
	show_boot_error();
	setTimeout( ()=>location.reload(), 6000 );
}
*/
addEventListener( 'load', async ()=>{
	show_status( 'Initializing' );

	function delay (ms) { return new Promise( done => setTimeout(done, ms) ); }

	try {
		await new Application();

		document.querySelectorAll( '.noscript' ).forEach( (element)=>{
			//...element.parentNode.removeChild( element );
		});
		document.querySelector( 'html' ).classList.remove('init')

	} catch (error) {
		watchdog( error );
	}
});


//EOF
