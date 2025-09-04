import {
	L as Logger,
	B as BigNumber,
	g as getDefaultExportFromCjs,
	V as VERSION,
	E as EthersNetwork,
	_ as __awaiter$1,
	n as noop,
	C as CustomNetworks,
	i as isAlchemyEvent,
	v as verifyAlchemyEventName,
	a as EthersEvent,
	b as getAlchemyEventTag,
	A as ALCHEMY_EVENT_TYPES,
	D as DEFAULT_ALCHEMY_API_KEY,
	c as ALCHEMY_PENDING_TRANSACTIONS_EVENT_TYPE,
	d as AlchemySubscription,
	e as ALCHEMY_MINED_TRANSACTIONS_EVENT_TYPE,
	f as fromHex,
	t as toHex,
} from '../worker.js';
import {
	v as version,
	J as JsonRpcProvider,
	d as defineReadOnly,
	A as AlchemyProvider,
	g as getNetwork,
} from './alchemy-provider-0b2e9f09-B3YBQ7sx.js';
import 'node:events';
import 'node:stream';
import 'cloudflare:workers';
import 'buffer';
import 'node:net';
import 'zlib';
import 'net';
import 'stream';
import 'path';
import 'url';
import 'assert';
import 'events';
let WS = null;
try {
	WS = WebSocket;
	if (WS == null) {
		throw new Error('inject please');
	}
} catch (error) {
	const logger2 = new Logger(version);
	WS = function () {
		logger2.throwError('WebSockets not supported in this environment', Logger.errors.UNSUPPORTED_OPERATION, {
			operation: 'new WebSocket()',
		});
	};
}
var __awaiter = function (thisArg, _arguments, P, generator) {
	function adopt(value) {
		return value instanceof P
			? value
			: new P(function (resolve) {
					resolve(value);
				});
	}
	return new (P || (P = Promise))(function (resolve, reject) {
		function fulfilled(value) {
			try {
				step(generator.next(value));
			} catch (e) {
				reject(e);
			}
		}
		function rejected(value) {
			try {
				step(generator['throw'](value));
			} catch (e) {
				reject(e);
			}
		}
		function step(result) {
			result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
		}
		step((generator = generator.apply(thisArg, _arguments || [])).next());
	});
};
const logger = new Logger(version);
let NextId = 1;
class WebSocketProvider extends JsonRpcProvider {
	constructor(url, network) {
		if (network === 'any') {
			logger.throwError("WebSocketProvider does not support 'any' network yet", Logger.errors.UNSUPPORTED_OPERATION, {
				operation: 'network:any',
			});
		}
		if (typeof url === 'string') {
			super(url, network);
		} else {
			super('_websocket', network);
		}
		this._pollingInterval = -1;
		this._wsReady = false;
		if (typeof url === 'string') {
			defineReadOnly(this, '_websocket', new WS(this.connection.url));
		} else {
			defineReadOnly(this, '_websocket', url);
		}
		defineReadOnly(this, '_requests', {});
		defineReadOnly(this, '_subs', {});
		defineReadOnly(this, '_subIds', {});
		defineReadOnly(this, '_detectNetwork', super.detectNetwork());
		this.websocket.onopen = () => {
			this._wsReady = true;
			Object.keys(this._requests).forEach((id) => {
				this.websocket.send(this._requests[id].payload);
			});
		};
		this.websocket.onmessage = (messageEvent) => {
			const data = messageEvent.data;
			const result = JSON.parse(data);
			if (result.id != null) {
				const id = String(result.id);
				const request = this._requests[id];
				delete this._requests[id];
				if (result.result !== void 0) {
					request.callback(null, result.result);
					this.emit('debug', {
						action: 'response',
						request: JSON.parse(request.payload),
						response: result.result,
						provider: this,
					});
				} else {
					let error = null;
					if (result.error) {
						error = new Error(result.error.message || 'unknown error');
						defineReadOnly(error, 'code', result.error.code || null);
						defineReadOnly(error, 'response', data);
					} else {
						error = new Error('unknown error');
					}
					request.callback(error, void 0);
					this.emit('debug', {
						action: 'response',
						error,
						request: JSON.parse(request.payload),
						provider: this,
					});
				}
			} else if (result.method === 'eth_subscription') {
				const sub = this._subs[result.params.subscription];
				if (sub) {
					sub.processFunc(result.params.result);
				}
			} else {
				console.warn('this should not happen');
			}
		};
		const fauxPoll = setInterval(() => {
			this.emit('poll');
		}, 1e3);
		if (fauxPoll.unref) {
			fauxPoll.unref();
		}
	}
	// Cannot narrow the type of _websocket, as that is not backwards compatible
	// so we add a getter and let the WebSocket be a public API.
	get websocket() {
		return this._websocket;
	}
	detectNetwork() {
		return this._detectNetwork;
	}
	get pollingInterval() {
		return 0;
	}
	resetEventsBlock(blockNumber) {
		logger.throwError('cannot reset events block on WebSocketProvider', Logger.errors.UNSUPPORTED_OPERATION, {
			operation: 'resetEventBlock',
		});
	}
	set pollingInterval(value) {
		logger.throwError('cannot set polling interval on WebSocketProvider', Logger.errors.UNSUPPORTED_OPERATION, {
			operation: 'setPollingInterval',
		});
	}
	poll() {
		return __awaiter(this, void 0, void 0, function* () {
			return null;
		});
	}
	set polling(value) {
		if (!value) {
			return;
		}
		logger.throwError('cannot set polling on WebSocketProvider', Logger.errors.UNSUPPORTED_OPERATION, {
			operation: 'setPolling',
		});
	}
	send(method, params) {
		const rid = NextId++;
		return new Promise((resolve, reject) => {
			function callback(error, result) {
				if (error) {
					return reject(error);
				}
				return resolve(result);
			}
			const payload = JSON.stringify({
				method,
				params,
				id: rid,
				jsonrpc: '2.0',
			});
			this.emit('debug', {
				action: 'request',
				request: JSON.parse(payload),
				provider: this,
			});
			this._requests[String(rid)] = { callback, payload };
			if (this._wsReady) {
				this.websocket.send(payload);
			}
		});
	}
	static defaultUrl() {
		return 'ws://localhost:8546';
	}
	_subscribe(tag, param, processFunc) {
		return __awaiter(this, void 0, void 0, function* () {
			let subIdPromise = this._subIds[tag];
			if (subIdPromise == null) {
				subIdPromise = Promise.all(param).then((param2) => {
					return this.send('eth_subscribe', param2);
				});
				this._subIds[tag] = subIdPromise;
			}
			const subId = yield subIdPromise;
			this._subs[subId] = { tag, processFunc };
		});
	}
	_startEvent(event) {
		switch (event.type) {
			case 'block':
				this._subscribe('block', ['newHeads'], (result) => {
					const blockNumber = BigNumber.from(result.number).toNumber();
					this._emitted.block = blockNumber;
					this.emit('block', blockNumber);
				});
				break;
			case 'pending':
				this._subscribe('pending', ['newPendingTransactions'], (result) => {
					this.emit('pending', result);
				});
				break;
			case 'filter':
				this._subscribe(event.tag, ['logs', this._getFilter(event.filter)], (result) => {
					if (result.removed == null) {
						result.removed = false;
					}
					this.emit(event.filter, this.formatter.filterLog(result));
				});
				break;
			case 'tx': {
				const emitReceipt = (event2) => {
					const hash = event2.hash;
					this.getTransactionReceipt(hash).then((receipt) => {
						if (!receipt) {
							return;
						}
						this.emit(hash, receipt);
					});
				};
				emitReceipt(event);
				this._subscribe('tx', ['newHeads'], (result) => {
					this._events.filter((e) => e.type === 'tx').forEach(emitReceipt);
				});
				break;
			}
			// Nothing is needed
			case 'debug':
			case 'poll':
			case 'willPoll':
			case 'didPoll':
			case 'error':
				break;
			default:
				console.log('unhandled:', event);
				break;
		}
	}
	_stopEvent(event) {
		let tag = event.tag;
		if (event.type === 'tx') {
			if (this._events.filter((e) => e.type === 'tx').length) {
				return;
			}
			tag = 'tx';
		} else if (this.listenerCount(event.event)) {
			return;
		}
		const subId = this._subIds[tag];
		if (!subId) {
			return;
		}
		delete this._subIds[tag];
		subId.then((subId2) => {
			if (!this._subs[subId2]) {
				return;
			}
			delete this._subs[subId2];
			this.send('eth_unsubscribe', [subId2]);
		});
	}
	destroy() {
		return __awaiter(this, void 0, void 0, function* () {
			if (this.websocket.readyState === WS.CONNECTING) {
				yield new Promise((resolve) => {
					this.websocket.onopen = function () {
						resolve(true);
					};
					this.websocket.onerror = function () {
						resolve(false);
					};
				});
			}
			this.websocket.close(1e3);
		});
	}
}
var dist = {};
var hasRequiredDist;
function requireDist() {
	if (hasRequiredDist) return dist;
	hasRequiredDist = 1;
	Object.defineProperty(dist, '__esModule', { value: true });
	var SHOULD_RECONNECT_FALSE_MESSAGE = 'Provided shouldReconnect() returned false. Closing permanently.';
	var SHOULD_RECONNECT_PROMISE_FALSE_MESSAGE = 'Provided shouldReconnect() resolved to false. Closing permanently.';
	var SturdyWebSocket2 =
		/** @class */
		(function () {
			function SturdyWebSocket3(url, protocolsOrOptions, options) {
				if (options === void 0) {
					options = {};
				}
				this.url = url;
				this.onclose = null;
				this.onerror = null;
				this.onmessage = null;
				this.onopen = null;
				this.ondown = null;
				this.onreopen = null;
				this.CONNECTING = SturdyWebSocket3.CONNECTING;
				this.OPEN = SturdyWebSocket3.OPEN;
				this.CLOSING = SturdyWebSocket3.CLOSING;
				this.CLOSED = SturdyWebSocket3.CLOSED;
				this.hasBeenOpened = false;
				this.isClosed = false;
				this.messageBuffer = [];
				this.nextRetryTime = 0;
				this.reconnectCount = 0;
				this.lastKnownExtensions = '';
				this.lastKnownProtocol = '';
				this.listeners = {};
				if (protocolsOrOptions == null || typeof protocolsOrOptions === 'string' || Array.isArray(protocolsOrOptions)) {
					this.protocols = protocolsOrOptions;
				} else {
					options = protocolsOrOptions;
				}
				this.options = applyDefaultOptions(options);
				if (!this.options.wsConstructor) {
					if (typeof WebSocket !== 'undefined') {
						this.options.wsConstructor = WebSocket;
					} else {
						throw new Error('WebSocket not present in global scope and no wsConstructor option was provided.');
					}
				}
				this.openNewWebSocket();
			}
			Object.defineProperty(SturdyWebSocket3.prototype, 'binaryType', {
				get: function () {
					return this.binaryTypeInternal || 'blob';
				},
				set: function (binaryType) {
					this.binaryTypeInternal = binaryType;
					if (this.ws) {
						this.ws.binaryType = binaryType;
					}
				},
				enumerable: true,
				configurable: true,
			});
			Object.defineProperty(SturdyWebSocket3.prototype, 'bufferedAmount', {
				get: function () {
					var sum = this.ws ? this.ws.bufferedAmount : 0;
					var hasUnknownAmount = false;
					this.messageBuffer.forEach(function (data) {
						var byteLength = getDataByteLength(data);
						if (byteLength != null) {
							sum += byteLength;
						} else {
							hasUnknownAmount = true;
						}
					});
					if (hasUnknownAmount) {
						this.debugLog('Some buffered data had unknown length. bufferedAmount() return value may be below the correct amount.');
					}
					return sum;
				},
				enumerable: true,
				configurable: true,
			});
			Object.defineProperty(SturdyWebSocket3.prototype, 'extensions', {
				get: function () {
					return this.ws ? this.ws.extensions : this.lastKnownExtensions;
				},
				enumerable: true,
				configurable: true,
			});
			Object.defineProperty(SturdyWebSocket3.prototype, 'protocol', {
				get: function () {
					return this.ws ? this.ws.protocol : this.lastKnownProtocol;
				},
				enumerable: true,
				configurable: true,
			});
			Object.defineProperty(SturdyWebSocket3.prototype, 'readyState', {
				get: function () {
					return this.isClosed ? SturdyWebSocket3.CLOSED : SturdyWebSocket3.OPEN;
				},
				enumerable: true,
				configurable: true,
			});
			SturdyWebSocket3.prototype.close = function (code, reason) {
				this.disposeSocket(code, reason);
				this.shutdown();
				this.debugLog('WebSocket permanently closed by client.');
			};
			SturdyWebSocket3.prototype.send = function (data) {
				if (this.isClosed) {
					throw new Error('WebSocket is already in CLOSING or CLOSED state.');
				} else if (this.ws && this.ws.readyState === this.OPEN) {
					this.ws.send(data);
				} else {
					this.messageBuffer.push(data);
				}
			};
			SturdyWebSocket3.prototype.reconnect = function () {
				if (this.isClosed) {
					throw new Error('Cannot call reconnect() on socket which is permanently closed.');
				}
				this.disposeSocket(1e3, 'Client requested reconnect.');
				this.handleClose(void 0);
			};
			SturdyWebSocket3.prototype.addEventListener = function (type, listener) {
				if (!this.listeners[type]) {
					this.listeners[type] = [];
				}
				this.listeners[type].push(listener);
			};
			SturdyWebSocket3.prototype.dispatchEvent = function (event) {
				return this.dispatchEventOfType(event.type, event);
			};
			SturdyWebSocket3.prototype.removeEventListener = function (type, listener) {
				if (this.listeners[type]) {
					this.listeners[type] = this.listeners[type].filter(function (l) {
						return l !== listener;
					});
				}
			};
			SturdyWebSocket3.prototype.openNewWebSocket = function () {
				var _this = this;
				if (this.isClosed) {
					return;
				}
				var _a = this.options,
					connectTimeout = _a.connectTimeout,
					wsConstructor = _a.wsConstructor;
				this.debugLog('Opening new WebSocket to ' + this.url + '.');
				var ws = new wsConstructor(this.url, this.protocols);
				ws.onclose = function (event) {
					return _this.handleClose(event);
				};
				ws.onerror = function (event) {
					return _this.handleError(event);
				};
				ws.onmessage = function (event) {
					return _this.handleMessage(event);
				};
				ws.onopen = function (event) {
					return _this.handleOpen(event);
				};
				this.connectTimeoutId = setTimeout(function () {
					_this.clearConnectTimeout();
					_this.disposeSocket();
					_this.handleClose(void 0);
				}, connectTimeout);
				this.ws = ws;
			};
			SturdyWebSocket3.prototype.handleOpen = function (event) {
				var _this = this;
				if (!this.ws || this.isClosed) {
					return;
				}
				var allClearResetTime = this.options.allClearResetTime;
				this.debugLog('WebSocket opened.');
				if (this.binaryTypeInternal != null) {
					this.ws.binaryType = this.binaryTypeInternal;
				} else {
					this.binaryTypeInternal = this.ws.binaryType;
				}
				this.clearConnectTimeout();
				if (this.hasBeenOpened) {
					this.dispatchEventOfType('reopen', event);
				} else {
					this.dispatchEventOfType('open', event);
					this.hasBeenOpened = true;
				}
				this.messageBuffer.forEach(function (message) {
					return _this.send(message);
				});
				this.messageBuffer = [];
				this.allClearTimeoutId = setTimeout(function () {
					_this.clearAllClearTimeout();
					_this.nextRetryTime = 0;
					_this.reconnectCount = 0;
					var openTime = (allClearResetTime / 1e3) | 0;
					_this.debugLog('WebSocket remained open for ' + openTime + ' seconds. Resetting retry time and count.');
				}, allClearResetTime);
			};
			SturdyWebSocket3.prototype.handleMessage = function (event) {
				if (this.isClosed) {
					return;
				}
				this.dispatchEventOfType('message', event);
			};
			SturdyWebSocket3.prototype.handleClose = function (event) {
				var _this = this;
				if (this.isClosed) {
					return;
				}
				var _a = this.options,
					maxReconnectAttempts = _a.maxReconnectAttempts,
					shouldReconnect = _a.shouldReconnect;
				this.clearConnectTimeout();
				this.clearAllClearTimeout();
				if (this.ws) {
					this.lastKnownExtensions = this.ws.extensions;
					this.lastKnownProtocol = this.ws.protocol;
					this.disposeSocket();
				}
				this.dispatchEventOfType('down', event);
				if (this.reconnectCount >= maxReconnectAttempts) {
					this.stopReconnecting(event, this.getTooManyFailedReconnectsMessage());
					return;
				}
				var willReconnect = !event || shouldReconnect(event);
				if (typeof willReconnect === 'boolean') {
					this.handleWillReconnect(willReconnect, event, SHOULD_RECONNECT_FALSE_MESSAGE);
				} else {
					willReconnect.then(function (willReconnectResolved) {
						if (_this.isClosed) {
							return;
						}
						_this.handleWillReconnect(willReconnectResolved, event, SHOULD_RECONNECT_PROMISE_FALSE_MESSAGE);
					});
				}
			};
			SturdyWebSocket3.prototype.handleError = function (event) {
				this.dispatchEventOfType('error', event);
				this.debugLog('WebSocket encountered an error.');
			};
			SturdyWebSocket3.prototype.handleWillReconnect = function (willReconnect, event, denialReason) {
				if (willReconnect) {
					this.reestablishConnection();
				} else {
					this.stopReconnecting(event, denialReason);
				}
			};
			SturdyWebSocket3.prototype.reestablishConnection = function () {
				var _this = this;
				var _a = this.options,
					minReconnectDelay = _a.minReconnectDelay,
					maxReconnectDelay = _a.maxReconnectDelay,
					reconnectBackoffFactor = _a.reconnectBackoffFactor;
				this.reconnectCount++;
				var retryTime = this.nextRetryTime;
				this.nextRetryTime = Math.max(minReconnectDelay, Math.min(this.nextRetryTime * reconnectBackoffFactor, maxReconnectDelay));
				setTimeout(function () {
					return _this.openNewWebSocket();
				}, retryTime);
				var retryTimeSeconds = (retryTime / 1e3) | 0;
				this.debugLog('WebSocket was closed. Re-opening in ' + retryTimeSeconds + ' seconds.');
			};
			SturdyWebSocket3.prototype.stopReconnecting = function (event, debugReason) {
				this.debugLog(debugReason);
				this.shutdown();
				if (event) {
					this.dispatchEventOfType('close', event);
				}
			};
			SturdyWebSocket3.prototype.shutdown = function () {
				this.isClosed = true;
				this.clearAllTimeouts();
				this.messageBuffer = [];
				this.disposeSocket();
			};
			SturdyWebSocket3.prototype.disposeSocket = function (closeCode, reason) {
				if (!this.ws) {
					return;
				}
				this.ws.onerror = noop2;
				this.ws.onclose = noop2;
				this.ws.onmessage = noop2;
				this.ws.onopen = noop2;
				this.ws.close(closeCode, reason);
				this.ws = void 0;
			};
			SturdyWebSocket3.prototype.clearAllTimeouts = function () {
				this.clearConnectTimeout();
				this.clearAllClearTimeout();
			};
			SturdyWebSocket3.prototype.clearConnectTimeout = function () {
				if (this.connectTimeoutId != null) {
					clearTimeout(this.connectTimeoutId);
					this.connectTimeoutId = void 0;
				}
			};
			SturdyWebSocket3.prototype.clearAllClearTimeout = function () {
				if (this.allClearTimeoutId != null) {
					clearTimeout(this.allClearTimeoutId);
					this.allClearTimeoutId = void 0;
				}
			};
			SturdyWebSocket3.prototype.dispatchEventOfType = function (type, event) {
				var _this = this;
				switch (type) {
					case 'close':
						if (this.onclose) {
							this.onclose(event);
						}
						break;
					case 'error':
						if (this.onerror) {
							this.onerror(event);
						}
						break;
					case 'message':
						if (this.onmessage) {
							this.onmessage(event);
						}
						break;
					case 'open':
						if (this.onopen) {
							this.onopen(event);
						}
						break;
					case 'down':
						if (this.ondown) {
							this.ondown(event);
						}
						break;
					case 'reopen':
						if (this.onreopen) {
							this.onreopen(event);
						}
						break;
				}
				if (type in this.listeners) {
					this.listeners[type].slice().forEach(function (listener) {
						return _this.callListener(listener, event);
					});
				}
				return !event || !event.defaultPrevented;
			};
			SturdyWebSocket3.prototype.callListener = function (listener, event) {
				if (typeof listener === 'function') {
					listener.call(this, event);
				} else {
					listener.handleEvent.call(this, event);
				}
			};
			SturdyWebSocket3.prototype.debugLog = function (message) {
				if (this.options.debug) {
					console.log(message);
				}
			};
			SturdyWebSocket3.prototype.getTooManyFailedReconnectsMessage = function () {
				var maxReconnectAttempts = this.options.maxReconnectAttempts;
				return (
					'Failed to reconnect after ' + maxReconnectAttempts + ' ' + pluralize('attempt', maxReconnectAttempts) + '. Closing permanently.'
				);
			};
			SturdyWebSocket3.DEFAULT_OPTIONS = {
				allClearResetTime: 5e3,
				connectTimeout: 5e3,
				debug: false,
				minReconnectDelay: 1e3,
				maxReconnectDelay: 3e4,
				maxReconnectAttempts: Number.POSITIVE_INFINITY,
				reconnectBackoffFactor: 1.5,
				shouldReconnect: function () {
					return true;
				},
				wsConstructor: void 0,
			};
			SturdyWebSocket3.CONNECTING = 0;
			SturdyWebSocket3.OPEN = 1;
			SturdyWebSocket3.CLOSING = 2;
			SturdyWebSocket3.CLOSED = 3;
			return SturdyWebSocket3;
		})();
	dist.default = SturdyWebSocket2;
	function applyDefaultOptions(options) {
		var result = {};
		Object.keys(SturdyWebSocket2.DEFAULT_OPTIONS).forEach(function (key) {
			var value = options[key];
			result[key] = value === void 0 ? SturdyWebSocket2.DEFAULT_OPTIONS[key] : value;
		});
		return result;
	}
	function getDataByteLength(data) {
		if (typeof data === 'string') {
			return 2 * data.length;
		} else if (data instanceof ArrayBuffer) {
			return data.byteLength;
		} else if (data instanceof Blob) {
			return data.size;
		} else {
			return void 0;
		}
	}
	function pluralize(s, n) {
		return n === 1 ? s : s + 's';
	}
	function noop2() {}
	return dist;
}
var distExports = requireDist();
const SturdyWebSocket = /* @__PURE__ */ getDefaultExportFromCjs(distExports);
const MAX_BACKFILL_BLOCKS = 120;
class WebsocketBackfiller {
	constructor(provider) {
		this.provider = provider;
		this.maxBackfillBlocks = MAX_BACKFILL_BLOCKS;
	}
	/**
	 * Runs backfill for `newHeads` events.
	 *
	 * @param isCancelled Whether the backfill request is cancelled.
	 * @param previousHeads Previous head requests that were sent.
	 * @param fromBlockNumber The block number to start backfilling from.
	 * @returns A list of `newHeads` events that were sent since the last backfill.
	 */
	getNewHeadsBackfill(isCancelled, previousHeads, fromBlockNumber) {
		return __awaiter$1(this, void 0, void 0, function* () {
			throwIfCancelled(isCancelled);
			const toBlockNumber = yield this.getBlockNumber();
			throwIfCancelled(isCancelled);
			if (previousHeads.length === 0) {
				return this.getHeadEventsInRange(Math.max(fromBlockNumber, toBlockNumber - this.maxBackfillBlocks) + 1, toBlockNumber + 1);
			}
			const lastSeenBlockNumber = fromHex(previousHeads[previousHeads.length - 1].number);
			const minBlockNumber = toBlockNumber - this.maxBackfillBlocks + 1;
			if (lastSeenBlockNumber <= minBlockNumber) {
				return this.getHeadEventsInRange(minBlockNumber, toBlockNumber + 1);
			}
			const reorgHeads = yield this.getReorgHeads(isCancelled, previousHeads);
			throwIfCancelled(isCancelled);
			const intermediateHeads = yield this.getHeadEventsInRange(lastSeenBlockNumber + 1, toBlockNumber + 1);
			throwIfCancelled(isCancelled);
			return [...reorgHeads, ...intermediateHeads];
		});
	}
	/**
	 * Runs backfill for `logs` events.
	 *
	 * @param isCancelled Whether the backfill request is cancelled.
	 * @param filter The filter object that accompanies a logs subscription.
	 * @param previousLogs Previous log requests that were sent.
	 * @param fromBlockNumber The block number to start backfilling from.
	 */
	getLogsBackfill(isCancelled, filter, previousLogs, fromBlockNumber) {
		return __awaiter$1(this, void 0, void 0, function* () {
			throwIfCancelled(isCancelled);
			const toBlockNumber = yield this.getBlockNumber();
			throwIfCancelled(isCancelled);
			if (previousLogs.length === 0) {
				return this.getLogsInRange(filter, Math.max(fromBlockNumber, toBlockNumber - this.maxBackfillBlocks) + 1, toBlockNumber + 1);
			}
			const lastSeenBlockNumber = fromHex(previousLogs[previousLogs.length - 1].blockNumber);
			const minBlockNumber = toBlockNumber - this.maxBackfillBlocks + 1;
			if (lastSeenBlockNumber < minBlockNumber) {
				return this.getLogsInRange(filter, minBlockNumber, toBlockNumber + 1);
			}
			const commonAncestor = yield this.getCommonAncestor(isCancelled, previousLogs);
			throwIfCancelled(isCancelled);
			const removedLogs = previousLogs
				.filter((log) => fromHex(log.blockNumber) > commonAncestor.blockNumber)
				.map((log) => Object.assign(Object.assign({}, log), { removed: true }));
			const fromBlockInclusive =
				commonAncestor.blockNumber === Number.NEGATIVE_INFINITY ? fromHex(previousLogs[0].blockNumber) : commonAncestor.blockNumber;
			let addedLogs = yield this.getLogsInRange(filter, fromBlockInclusive, toBlockNumber + 1);
			addedLogs = addedLogs.filter(
				(log) => log && (fromHex(log.blockNumber) > commonAncestor.blockNumber || fromHex(log.logIndex) > commonAncestor.logIndex),
			);
			throwIfCancelled(isCancelled);
			return [...removedLogs, ...addedLogs];
		});
	}
	/**
	 * Sets a new max backfill blocks. VISIBLE ONLY FOR TESTING.
	 *
	 * @internal
	 */
	setMaxBackfillBlock(newMax) {
		this.maxBackfillBlocks = newMax;
	}
	/**
	 * Gets the current block number as a number.
	 *
	 * @private
	 */
	getBlockNumber() {
		return __awaiter$1(this, void 0, void 0, function* () {
			const blockNumberHex = yield this.provider.send('eth_blockNumber');
			return fromHex(blockNumberHex);
		});
	}
	/**
	 * Gets all `newHead` events in the provided range. Note that the returned
	 * heads do not include re-orged heads. Use {@link getReorgHeads} to find heads
	 * that were part of a re-org.
	 *
	 * @private
	 */
	getHeadEventsInRange(fromBlockInclusive, toBlockExclusive) {
		return __awaiter$1(this, void 0, void 0, function* () {
			if (fromBlockInclusive >= toBlockExclusive) {
				return [];
			}
			const batchParts = [];
			for (let i = fromBlockInclusive; i < toBlockExclusive; i++) {
				batchParts.push({
					method: 'eth_getBlockByNumber',
					params: [toHex(i), false],
				});
			}
			const blockHeads = yield this.provider.sendBatch(batchParts);
			return blockHeads.map(toNewHeadsEvent);
		});
	}
	/**
	 * Returns all heads that were part of a reorg event.
	 *
	 * @private
	 */
	getReorgHeads(isCancelled, previousHeads) {
		return __awaiter$1(this, void 0, void 0, function* () {
			const result = [];
			for (let i = previousHeads.length - 1; i >= 0; i--) {
				const oldEvent = previousHeads[i];
				const blockHead = yield this.getBlockByNumber(fromHex(oldEvent.number));
				throwIfCancelled(isCancelled);
				if (oldEvent.hash === blockHead.hash) {
					break;
				}
				result.push(toNewHeadsEvent(blockHead));
			}
			return result.reverse();
		});
	}
	/**
	 * Simple wrapper around `eth_getBlockByNumber` that returns the complete
	 * block information for the provided block number.
	 *
	 * @private
	 */
	getBlockByNumber(blockNumber) {
		return __awaiter$1(this, void 0, void 0, function* () {
			return this.provider.send('eth_getBlockByNumber', [toHex(blockNumber), false]);
		});
	}
	/**
	 * Given a list of previous log events, finds the common block number from the
	 * logs that matches the block head.
	 *
	 * This can be used to identify which logs are part of a re-org.
	 *
	 * Returns 1 less than the oldest log's block number if no common ancestor was found.
	 *
	 * @private
	 */
	getCommonAncestor(isCancelled, previousLogs) {
		return __awaiter$1(this, void 0, void 0, function* () {
			let blockHead = yield this.getBlockByNumber(fromHex(previousLogs[previousLogs.length - 1].blockNumber));
			throwIfCancelled(isCancelled);
			for (let i = previousLogs.length - 1; i >= 0; i--) {
				const oldLog = previousLogs[i];
				if (oldLog.blockNumber !== blockHead.number) {
					blockHead = yield this.getBlockByNumber(fromHex(oldLog.blockNumber));
				}
				if (oldLog.blockHash === blockHead.hash) {
					return {
						blockNumber: fromHex(oldLog.blockNumber),
						logIndex: fromHex(oldLog.logIndex),
					};
				}
			}
			return {
				blockNumber: Number.NEGATIVE_INFINITY,
				logIndex: Number.NEGATIVE_INFINITY,
			};
		});
	}
	/**
	 * Gets all `logs` events in the provided range. Note that the returned logs
	 * do not include removed logs.
	 *
	 * @private
	 */
	getLogsInRange(filter, fromBlockInclusive, toBlockExclusive) {
		return __awaiter$1(this, void 0, void 0, function* () {
			if (fromBlockInclusive >= toBlockExclusive) {
				return [];
			}
			const rangeFilter = Object.assign(Object.assign({}, filter), {
				fromBlock: toHex(fromBlockInclusive),
				toBlock: toHex(toBlockExclusive - 1),
			});
			return this.provider.send('eth_getLogs', [rangeFilter]);
		});
	}
}
function toNewHeadsEvent(head) {
	const result = Object.assign({}, head);
	delete result.totalDifficulty;
	delete result.transactions;
	delete result.uncles;
	return result;
}
function dedupeNewHeads(events) {
	return dedupe(events, (event) => event.hash);
}
function dedupeLogs(events) {
	return dedupe(events, (event) => `${event.blockHash}/${event.logIndex}`);
}
function dedupe(items, getKey) {
	const keysSeen = /* @__PURE__ */ new Set();
	const result = [];
	items.forEach((item) => {
		const key = getKey(item);
		if (!keysSeen.has(key)) {
			keysSeen.add(key);
			result.push(item);
		}
	});
	return result;
}
const CANCELLED = new Error('Cancelled');
function throwIfCancelled(isCancelled) {
	if (isCancelled()) {
		throw CANCELLED;
	}
}
const HEARTBEAT_INTERVAL = 3e4;
const HEARTBEAT_WAIT_TIME = 1e4;
const BACKFILL_TIMEOUT = 6e4;
const BACKFILL_RETRIES = 5;
const RETAINED_EVENT_BLOCK_COUNT = 10;
class AlchemyWebSocketProvider extends WebSocketProvider {
	/** @internal */
	constructor(config, wsConstructor) {
		var _a;
		const apiKey = AlchemyProvider.getApiKey(config.apiKey);
		const alchemyNetwork = AlchemyProvider.getAlchemyNetwork(config.network);
		const connection = AlchemyProvider.getAlchemyConnectionInfo(alchemyNetwork, apiKey, 'wss');
		const protocol = `alchemy-sdk-${VERSION}`;
		const ws = new SturdyWebSocket((_a = config.url) !== null && _a !== void 0 ? _a : connection.url, protocol, {
			wsConstructor: wsConstructor !== null && wsConstructor !== void 0 ? wsConstructor : getWebsocketConstructor(),
		});
		const ethersNetwork = EthersNetwork[alchemyNetwork];
		super(ws, ethersNetwork !== null && ethersNetwork !== void 0 ? ethersNetwork : void 0);
		this._events = [];
		this.virtualSubscriptionsById = /* @__PURE__ */ new Map();
		this.virtualIdsByPhysicalId = /* @__PURE__ */ new Map();
		this.handleMessage = (event) => {
			const message = JSON.parse(event.data);
			if (!isSubscriptionEvent(message)) {
				return;
			}
			const physicalId = message.params.subscription;
			const virtualId = this.virtualIdsByPhysicalId.get(physicalId);
			if (!virtualId) {
				return;
			}
			const subscription = this.virtualSubscriptionsById.get(virtualId);
			if (subscription.method !== 'eth_subscribe') {
				return;
			}
			switch (subscription.params[0]) {
				case 'newHeads': {
					const newHeadsSubscription = subscription;
					const newHeadsMessage = message;
					const { isBackfilling, backfillBuffer } = newHeadsSubscription;
					const { result } = newHeadsMessage.params;
					if (isBackfilling) {
						addToNewHeadsEventsBuffer(backfillBuffer, result);
					} else if (physicalId !== virtualId) {
						this.emitAndRememberEvent(virtualId, result, getNewHeadsBlockNumber);
					} else {
						this.rememberEvent(virtualId, result, getNewHeadsBlockNumber);
					}
					break;
				}
				case 'logs': {
					const logsSubscription = subscription;
					const logsMessage = message;
					const { isBackfilling, backfillBuffer } = logsSubscription;
					const { result } = logsMessage.params;
					if (isBackfilling) {
						addToLogsEventsBuffer(backfillBuffer, result);
					} else if (virtualId !== physicalId) {
						this.emitAndRememberEvent(virtualId, result, getLogsBlockNumber);
					} else {
						this.rememberEvent(virtualId, result, getLogsBlockNumber);
					}
					break;
				}
				default:
					if (physicalId !== virtualId) {
						const { result } = message.params;
						this.emitEvent(virtualId, result);
					}
			}
		};
		this.handleReopen = () => {
			this.virtualIdsByPhysicalId.clear();
			const { cancel, isCancelled } = makeCancelToken();
			this.cancelBackfill = cancel;
			for (const subscription of this.virtualSubscriptionsById.values()) {
				void (() =>
					__awaiter$1(this, void 0, void 0, function* () {
						try {
							yield this.resubscribeAndBackfill(isCancelled, subscription);
						} catch (error) {
							if (!isCancelled()) {
								console.error(`Error while backfilling "${subscription.params[0]}" subscription. Some events may be missing.`, error);
							}
						}
					}))();
			}
			this.startHeartbeat();
		};
		this.stopHeartbeatAndBackfill = () => {
			if (this.heartbeatIntervalId != null) {
				clearInterval(this.heartbeatIntervalId);
				this.heartbeatIntervalId = void 0;
			}
			this.cancelBackfill();
		};
		this.apiKey = apiKey;
		this.backfiller = new WebsocketBackfiller(this);
		this.addSocketListeners();
		this.startHeartbeat();
		this.cancelBackfill = noop;
	}
	/**
	 * Overrides the `BaseProvider.getNetwork` method as implemented by ethers.js.
	 *
	 * This override allows the SDK to set the provider's network to values not
	 * yet supported by ethers.js.
	 *
	 * @internal
	 * @override
	 */
	static getNetwork(network) {
		if (typeof network === 'string' && network in CustomNetworks) {
			return CustomNetworks[network];
		}
		return getNetwork(network);
	}
	/**
	 * Overridden implementation of ethers that includes Alchemy based subscriptions.
	 *
	 * @param eventName Event to subscribe to
	 * @param listener The listener function to call when the event is triggered.
	 * @override
	 * @public
	 */
	// TODO: Override `Listener` type to get type autocompletions.
	on(eventName, listener) {
		return this._addEventListener(eventName, listener, false);
	}
	/**
	 * Overridden implementation of ethers that includes Alchemy based
	 * subscriptions. Adds a listener to the triggered for only the next
	 * {@link eventName} event, after which it will be removed.
	 *
	 * @param eventName Event to subscribe to
	 * @param listener The listener function to call when the event is triggered.
	 * @override
	 * @public
	 */
	// TODO: Override `Listener` type to get type autocompletions.
	once(eventName, listener) {
		return this._addEventListener(eventName, listener, true);
	}
	/**
	 * Removes the provided {@link listener} for the {@link eventName} event. If no
	 * listener is provided, all listeners for the event will be removed.
	 *
	 * @param eventName Event to unlisten to.
	 * @param listener The listener function to remove.
	 * @override
	 * @public
	 */
	off(eventName, listener) {
		if (isAlchemyEvent(eventName)) {
			return this._off(eventName, listener);
		} else {
			return super.off(eventName, listener);
		}
	}
	/**
	 * Remove all listeners for the provided {@link eventName} event. If no event
	 * is provided, all events and their listeners are removed.
	 *
	 * @param eventName The event to remove all listeners for.
	 * @override
	 * @public
	 */
	removeAllListeners(eventName) {
		if (eventName !== void 0 && isAlchemyEvent(eventName)) {
			return this._removeAllListeners(eventName);
		} else {
			return super.removeAllListeners(eventName);
		}
	}
	/**
	 * Returns the number of listeners for the provided {@link eventName} event. If
	 * no event is provided, the total number of listeners for all events is returned.
	 *
	 * @param eventName The event to get the number of listeners for.
	 * @public
	 * @override
	 */
	listenerCount(eventName) {
		if (eventName !== void 0 && isAlchemyEvent(eventName)) {
			return this._listenerCount(eventName);
		} else {
			return super.listenerCount(eventName);
		}
	}
	/**
	 * Returns an array of listeners for the provided {@link eventName} event. If
	 * no event is provided, all listeners will be included.
	 *
	 * @param eventName The event to get the listeners for.
	 * @public
	 * @override
	 */
	listeners(eventName) {
		if (eventName !== void 0 && isAlchemyEvent(eventName)) {
			return this._listeners(eventName);
		} else {
			return super.listeners(eventName);
		}
	}
	/**
	 * Overrides the method in `BaseProvider` in order to properly format the
	 * Alchemy subscription events.
	 *
	 * @internal
	 * @override
	 */
	_addEventListener(eventName, listener, once) {
		if (isAlchemyEvent(eventName)) {
			verifyAlchemyEventName(eventName);
			const event = new EthersEvent(getAlchemyEventTag(eventName), listener, once);
			this._events.push(event);
			this._startEvent(event);
			return this;
		} else {
			return super._addEventListener(eventName, listener, once);
		}
	}
	/**
	 * Overrides the `_startEvent()` method in ethers.js's
	 * {@link WebSocketProvider} to include additional alchemy methods.
	 *
	 * @param event
	 * @override
	 * @internal
	 */
	_startEvent(event) {
		const customLogicTypes = [...ALCHEMY_EVENT_TYPES, 'block', 'filter'];
		if (customLogicTypes.includes(event.type)) {
			this.customStartEvent(event);
		} else {
			super._startEvent(event);
		}
	}
	/**
	 * Overridden from ethers.js's {@link WebSocketProvider}
	 *
	 * Modified in order to add mappings for backfilling.
	 *
	 * @internal
	 * @override
	 */
	_subscribe(tag, param, processFunc, event) {
		return __awaiter$1(this, void 0, void 0, function* () {
			let subIdPromise = this._subIds[tag];
			const startingBlockNumber = yield this.getBlockNumber();
			if (subIdPromise == null) {
				subIdPromise = Promise.all(param).then((param2) => {
					return this.send('eth_subscribe', param2);
				});
				this._subIds[tag] = subIdPromise;
			}
			const subId = yield subIdPromise;
			const resolvedParams = yield Promise.all(param);
			this.virtualSubscriptionsById.set(subId, {
				event,
				method: 'eth_subscribe',
				params: resolvedParams,
				startingBlockNumber,
				virtualId: subId,
				physicalId: subId,
				sentEvents: [],
				isBackfilling: false,
				backfillBuffer: [],
			});
			this.virtualIdsByPhysicalId.set(subId, subId);
			this._subs[subId] = { tag, processFunc };
		});
	}
	/**
	 * DO NOT MODIFY.
	 *
	 * Original code copied over from ether.js's `BaseProvider`.
	 *
	 * This method is copied over directly in order to implement Alchemy's unique
	 * subscription types. The only difference is that this method calls
	 * {@link getAlchemyEventTag} instead of the original `getEventTag()` method in
	 * order to parse the Alchemy subscription event.
	 *
	 * @internal
	 * @override
	 */
	emit(eventName, ...args) {
		if (isAlchemyEvent(eventName)) {
			let result = false;
			const stopped = [];
			const eventTag = getAlchemyEventTag(eventName);
			this._events = this._events.filter((event) => {
				if (event.tag !== eventTag) {
					return true;
				}
				setTimeout(() => {
					event.listener.apply(this, args);
				}, 0);
				result = true;
				if (event.once) {
					stopped.push(event);
					return false;
				}
				return true;
			});
			stopped.forEach((event) => {
				this._stopEvent(event);
			});
			return result;
		} else {
			return super.emit(eventName, ...args);
		}
	}
	/** @internal */
	sendBatch(parts) {
		return __awaiter$1(this, void 0, void 0, function* () {
			let nextId = 0;
			const payload = parts.map(({ method, params }) => {
				return {
					method,
					params,
					jsonrpc: '2.0',
					id: `alchemy-sdk:${nextId++}`,
				};
			});
			return this.sendBatchConcurrently(payload);
		});
	}
	/** @override */
	destroy() {
		this.removeSocketListeners();
		this.stopHeartbeatAndBackfill();
		return super.destroy();
	}
	/**
	 * Overrides the ether's `isCommunityResource()` method. Returns true if the
	 * current api key is the default key.
	 *
	 * @override
	 */
	isCommunityResource() {
		return this.apiKey === DEFAULT_ALCHEMY_API_KEY;
	}
	/**
	 * DO NOT MODIFY.
	 *
	 * Original code copied over from ether.js's `WebSocketProvider._stopEvent()`.
	 *
	 * This method is copied over directly in order to support Alchemy's
	 * subscription type by allowing the provider to properly stop Alchemy's
	 * subscription events.
	 *
	 * @internal
	 */
	_stopEvent(event) {
		let tag = event.tag;
		if (ALCHEMY_EVENT_TYPES.includes(event.type)) {
			if (this._events.filter((e) => ALCHEMY_EVENT_TYPES.includes(e.type)).length) {
				return;
			}
		} else if (event.type === 'tx') {
			if (this._events.filter((e) => e.type === 'tx').length) {
				return;
			}
			tag = 'tx';
		} else if (this.listenerCount(event.event)) {
			return;
		}
		const subId = this._subIds[tag];
		if (!subId) {
			return;
		}
		delete this._subIds[tag];
		void subId.then((subId2) => {
			if (!this._subs[subId2]) {
				return;
			}
			delete this._subs[subId2];
			void this.send('eth_unsubscribe', [subId2]);
		});
	}
	/** @internal */
	addSocketListeners() {
		this._websocket.addEventListener('message', this.handleMessage);
		this._websocket.addEventListener('reopen', this.handleReopen);
		this._websocket.addEventListener('down', this.stopHeartbeatAndBackfill);
	}
	/** @internal */
	removeSocketListeners() {
		this._websocket.removeEventListener('message', this.handleMessage);
		this._websocket.removeEventListener('reopen', this.handleReopen);
		this._websocket.removeEventListener('down', this.stopHeartbeatAndBackfill);
	}
	/**
	 * Reopens the backfill based on
	 *
	 * @param isCancelled
	 * @param subscription
	 * @internal
	 */
	resubscribeAndBackfill(isCancelled, subscription) {
		return __awaiter$1(this, void 0, void 0, function* () {
			const { virtualId, method, params, sentEvents, backfillBuffer, startingBlockNumber } = subscription;
			subscription.isBackfilling = true;
			backfillBuffer.length = 0;
			try {
				const physicalId = yield this.send(method, params);
				throwIfCancelled(isCancelled);
				subscription.physicalId = physicalId;
				this.virtualIdsByPhysicalId.set(physicalId, virtualId);
				switch (params[0]) {
					case 'newHeads': {
						const backfillEvents = yield withBackoffRetries(
							() => withTimeout(this.backfiller.getNewHeadsBackfill(isCancelled, sentEvents, startingBlockNumber), BACKFILL_TIMEOUT),
							BACKFILL_RETRIES,
							() => !isCancelled(),
						);
						throwIfCancelled(isCancelled);
						const events = dedupeNewHeads([...backfillEvents, ...backfillBuffer]);
						events.forEach((event) => this.emitNewHeadsEvent(virtualId, event));
						break;
					}
					case 'logs': {
						const filter = params[1] || {};
						const backfillEvents = yield withBackoffRetries(
							() => withTimeout(this.backfiller.getLogsBackfill(isCancelled, filter, sentEvents, startingBlockNumber), BACKFILL_TIMEOUT),
							BACKFILL_RETRIES,
							() => !isCancelled(),
						);
						throwIfCancelled(isCancelled);
						const events = dedupeLogs([...backfillEvents, ...backfillBuffer]);
						events.forEach((event) => this.emitLogsEvent(virtualId, event));
						break;
					}
					default:
						break;
				}
			} finally {
				subscription.isBackfilling = false;
				backfillBuffer.length = 0;
			}
		});
	}
	/** @internal */
	emitNewHeadsEvent(virtualId, result) {
		this.emitAndRememberEvent(virtualId, result, getNewHeadsBlockNumber);
	}
	/** @internal */
	emitLogsEvent(virtualId, result) {
		this.emitAndRememberEvent(virtualId, result, getLogsBlockNumber);
	}
	/**
	 * Emits an event to consumers, but also remembers it in its subscriptions's
	 * `sentEvents` buffer so that we can detect re-orgs if the connection drops
	 * and needs to be reconnected.
	 *
	 * @internal
	 */
	emitAndRememberEvent(virtualId, result, getBlockNumber) {
		this.rememberEvent(virtualId, result, getBlockNumber);
		this.emitEvent(virtualId, result);
	}
	emitEvent(virtualId, result) {
		const subscription = this.virtualSubscriptionsById.get(virtualId);
		if (!subscription) {
			return;
		}
		this.emitGenericEvent(subscription, result);
	}
	/** @internal */
	rememberEvent(virtualId, result, getBlockNumber) {
		const subscription = this.virtualSubscriptionsById.get(virtualId);
		if (!subscription) {
			return;
		}
		addToPastEventsBuffer(subscription.sentEvents, Object.assign({}, result), getBlockNumber);
	}
	/** @internal */
	emitGenericEvent(subscription, result) {
		const emitFunction = this.emitProcessFn(subscription.event);
		emitFunction(result);
	}
	/**
	 * Starts a heartbeat that pings the websocket server periodically to ensure
	 * that the connection stays open.
	 *
	 * @internal
	 */
	startHeartbeat() {
		if (this.heartbeatIntervalId != null) {
			return;
		}
		this.heartbeatIntervalId = setInterval(
			() =>
				__awaiter$1(this, void 0, void 0, function* () {
					try {
						yield withTimeout(this.send('net_version'), HEARTBEAT_WAIT_TIME);
					} catch (_a) {
						this._websocket.reconnect();
					}
				}),
			HEARTBEAT_INTERVAL,
		);
	}
	/**
	 * This method sends the batch concurrently as individual requests rather than
	 * as a batch, which was the original implementation. The original batch logic
	 * is preserved in this implementation in order for faster porting.
	 *
	 * @param payload
	 * @internal
	 */
	// TODO(cleanup): Refactor and remove usages of `sendBatch()`.
	// TODO(errors): Use allSettled() once we have more error handling.
	sendBatchConcurrently(payload) {
		return __awaiter$1(this, void 0, void 0, function* () {
			return Promise.all(payload.map((req) => this.send(req.method, req.params)));
		});
	}
	/** @internal */
	customStartEvent(event) {
		if (event.type === ALCHEMY_PENDING_TRANSACTIONS_EVENT_TYPE) {
			const { fromAddress, toAddress, hashesOnly } = event;
			void this._subscribe(
				event.tag,
				[AlchemySubscription.PENDING_TRANSACTIONS, { fromAddress, toAddress, hashesOnly }],
				this.emitProcessFn(event),
				event,
			);
		} else if (event.type === ALCHEMY_MINED_TRANSACTIONS_EVENT_TYPE) {
			const { addresses, includeRemoved, hashesOnly } = event;
			void this._subscribe(
				event.tag,
				[AlchemySubscription.MINED_TRANSACTIONS, { addresses, includeRemoved, hashesOnly }],
				this.emitProcessFn(event),
				event,
			);
		} else if (event.type === 'block') {
			void this._subscribe('block', ['newHeads'], this.emitProcessFn(event), event);
		} else if (event.type === 'filter') {
			void this._subscribe(event.tag, ['logs', this._getFilter(event.filter)], this.emitProcessFn(event), event);
		}
	}
	/** @internal */
	emitProcessFn(event) {
		switch (event.type) {
			case ALCHEMY_PENDING_TRANSACTIONS_EVENT_TYPE:
				return (result) =>
					this.emit(
						{
							method: AlchemySubscription.PENDING_TRANSACTIONS,
							fromAddress: event.fromAddress,
							toAddress: event.toAddress,
							hashesOnly: event.hashesOnly,
						},
						result,
					);
			case ALCHEMY_MINED_TRANSACTIONS_EVENT_TYPE:
				return (result) =>
					this.emit(
						{
							method: AlchemySubscription.MINED_TRANSACTIONS,
							addresses: event.addresses,
							includeRemoved: event.includeRemoved,
							hashesOnly: event.hashesOnly,
						},
						result,
					);
			case 'block':
				return (result) => {
					const blockNumber = BigNumber.from(result.number).toNumber();
					this._emitted.block = blockNumber;
					this.emit('block', blockNumber);
				};
			case 'filter':
				return (result) => {
					if (result.removed == null) {
						result.removed = false;
					}
					this.emit(event.filter, this.formatter.filterLog(result));
				};
			default:
				throw new Error('Invalid event type to `emitProcessFn()`');
		}
	}
	/**
	 * DO NOT MODIFY.
	 *
	 * Original code copied over from ether.js's `BaseProvider.off()`.
	 *
	 * This method is copied over directly in order to implement Alchemy's unique
	 * subscription types. The only difference is that this method calls
	 * {@link getAlchemyEventTag} instead of the original `getEventTag()` method in
	 * order to parse the Alchemy subscription event.
	 *
	 * @private
	 */
	_off(eventName, listener) {
		if (listener == null) {
			return this.removeAllListeners(eventName);
		}
		const stopped = [];
		let found = false;
		const eventTag = getAlchemyEventTag(eventName);
		this._events = this._events.filter((event) => {
			if (event.tag !== eventTag || event.listener != listener) {
				return true;
			}
			if (found) {
				return true;
			}
			found = true;
			stopped.push(event);
			return false;
		});
		stopped.forEach((event) => {
			this._stopEvent(event);
		});
		return this;
	}
	/**
	 * DO NOT MODIFY.
	 *
	 * Original code copied over from ether.js's `BaseProvider.removeAllListeners()`.
	 *
	 * This method is copied over directly in order to implement Alchemy's unique
	 * subscription types. The only difference is that this method calls
	 * {@link getAlchemyEventTag} instead of the original `getEventTag()` method in
	 * order to parse the Alchemy subscription event.
	 *
	 * @private
	 */
	_removeAllListeners(eventName) {
		let stopped = [];
		if (eventName == null) {
			stopped = this._events;
			this._events = [];
		} else {
			const eventTag = getAlchemyEventTag(eventName);
			this._events = this._events.filter((event) => {
				if (event.tag !== eventTag) {
					return true;
				}
				stopped.push(event);
				return false;
			});
		}
		stopped.forEach((event) => {
			this._stopEvent(event);
		});
		return this;
	}
	/**
	 * DO NOT MODIFY.
	 *
	 * Original code copied over from ether.js's `BaseProvider.listenerCount()`.
	 *
	 * This method is copied over directly in order to implement Alchemy's unique
	 * subscription types. The only difference is that this method calls
	 * {@link getAlchemyEventTag} instead of the original `getEventTag()` method in
	 * order to parse the Alchemy subscription event.
	 *
	 * @private
	 */
	_listenerCount(eventName) {
		if (!eventName) {
			return this._events.length;
		}
		const eventTag = getAlchemyEventTag(eventName);
		return this._events.filter((event) => {
			return event.tag === eventTag;
		}).length;
	}
	/**
	 * DO NOT MODIFY.
	 *
	 * Original code copied over from ether.js's `BaseProvider.listeners()`.
	 *
	 * This method is copied over directly in order to implement Alchemy's unique
	 * subscription types. The only difference is that this method calls
	 * {@link getAlchemyEventTag} instead of the original `getEventTag()` method in
	 * order to parse the Alchemy subscription event.
	 *
	 * @private
	 */
	_listeners(eventName) {
		if (eventName == null) {
			return this._events.map((event) => event.listener);
		}
		const eventTag = getAlchemyEventTag(eventName);
		return this._events.filter((event) => event.tag === eventTag).map((event) => event.listener);
	}
}
function getWebsocketConstructor() {
	return isNodeEnvironment() ? require('websocket').w3cwebsocket : WebSocket;
}
function isNodeEnvironment() {
	return typeof process !== 'undefined' && process != null && process.versions != null && process.versions.node != null;
}
function makeCancelToken() {
	let cancelled = false;
	return { cancel: () => (cancelled = true), isCancelled: () => cancelled };
}
const MIN_RETRY_DELAY = 1e3;
const RETRY_BACKOFF_FACTOR = 2;
const MAX_RETRY_DELAY = 3e4;
function withBackoffRetries(f, retryCount, shouldRetry = () => true) {
	return __awaiter$1(this, void 0, void 0, function* () {
		let nextWaitTime = 0;
		let i = 0;
		while (true) {
			try {
				return yield f();
			} catch (error) {
				i++;
				if (i >= retryCount || !shouldRetry(error)) {
					throw error;
				}
				yield delay(nextWaitTime);
				if (!shouldRetry(error)) {
					throw error;
				}
				nextWaitTime = nextWaitTime === 0 ? MIN_RETRY_DELAY : Math.min(MAX_RETRY_DELAY, RETRY_BACKOFF_FACTOR * nextWaitTime);
			}
		}
	});
}
function delay(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
function withTimeout(promise, ms) {
	return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms))]);
}
function getNewHeadsBlockNumber(event) {
	return fromHex(event.number);
}
function getLogsBlockNumber(event) {
	return fromHex(event.blockNumber);
}
function isResponse(message) {
	return Array.isArray(message) || (message.jsonrpc === '2.0' && message.id !== void 0);
}
function isSubscriptionEvent(message) {
	return !isResponse(message);
}
function addToNewHeadsEventsBuffer(pastEvents, event) {
	addToPastEventsBuffer(pastEvents, event, getNewHeadsBlockNumber);
}
function addToLogsEventsBuffer(pastEvents, event) {
	addToPastEventsBuffer(pastEvents, event, getLogsBlockNumber);
}
function addToPastEventsBuffer(pastEvents, event, getBlockNumber) {
	const currentBlockNumber = getBlockNumber(event);
	const firstGoodIndex = pastEvents.findIndex((e) => getBlockNumber(e) > currentBlockNumber - RETAINED_EVENT_BLOCK_COUNT);
	if (firstGoodIndex === -1) {
		pastEvents.length = 0;
	} else {
		pastEvents.splice(0, firstGoodIndex);
	}
	pastEvents.push(event);
}
export { AlchemyWebSocketProvider };
