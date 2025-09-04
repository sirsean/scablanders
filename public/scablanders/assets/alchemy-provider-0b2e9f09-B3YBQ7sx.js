import {
	h as commonjsGlobal,
	g as getDefaultExportFromCjs,
	j as arrayify,
	B as BigNumber,
	L as Logger,
	k as concat,
	l as hexlify,
	m as isBytesLike,
	o as _base36To16,
	s as stripZeros,
	p as hexDataSlice,
	q as isHexString,
	r as hexConcat,
	u as hexZeroPad,
	w as require$$0,
	x as BN,
	y as splitSignature,
	z as hexDataLength,
	F as hexValue,
	E as EthersNetwork,
	D as DEFAULT_ALCHEMY_API_KEY,
	C as CustomNetworks,
	G as DEFAULT_NETWORK,
	N as Network,
	H as getAlchemyHttpUrl,
	I as getAlchemyWsUrl,
	V as VERSION,
	J as IS_BROWSER,
	_ as __awaiter$1$1,
	K as logWarn,
	M as deepCopy$1,
} from '../worker.js';
var sha3$1 = { exports: {} };
/**
 * [js-sha3]{@link https://github.com/emn178/js-sha3}
 *
 * @version 0.8.0
 * @author Chen, Yi-Cyuan [emn178@gmail.com]
 * @copyright Chen, Yi-Cyuan 2015-2018
 * @license MIT
 */
var hasRequiredSha3;
function requireSha3() {
	if (hasRequiredSha3) return sha3$1.exports;
	hasRequiredSha3 = 1;
	(function (module) {
		(function () {
			var INPUT_ERROR = 'input is invalid type';
			var FINALIZE_ERROR = 'finalize already called';
			var WINDOW = typeof window === 'object';
			var root = WINDOW ? window : {};
			if (root.JS_SHA3_NO_WINDOW) {
				WINDOW = false;
			}
			var WEB_WORKER = !WINDOW && typeof self === 'object';
			var NODE_JS = !root.JS_SHA3_NO_NODE_JS && typeof process === 'object' && process.versions && process.versions.node;
			if (NODE_JS) {
				root = commonjsGlobal;
			} else if (WEB_WORKER) {
				root = self;
			}
			var COMMON_JS = !root.JS_SHA3_NO_COMMON_JS && true && module.exports;
			var ARRAY_BUFFER = !root.JS_SHA3_NO_ARRAY_BUFFER && typeof ArrayBuffer !== 'undefined';
			var HEX_CHARS = '0123456789abcdef'.split('');
			var SHAKE_PADDING = [31, 7936, 2031616, 520093696];
			var CSHAKE_PADDING = [4, 1024, 262144, 67108864];
			var KECCAK_PADDING = [1, 256, 65536, 16777216];
			var PADDING = [6, 1536, 393216, 100663296];
			var SHIFT = [0, 8, 16, 24];
			var RC = [
				1, 0, 32898, 0, 32906, 2147483648, 2147516416, 2147483648, 32907, 0, 2147483649, 0, 2147516545, 2147483648, 32777, 2147483648, 138,
				0, 136, 0, 2147516425, 0, 2147483658, 0, 2147516555, 0, 139, 2147483648, 32905, 2147483648, 32771, 2147483648, 32770, 2147483648,
				128, 2147483648, 32778, 0, 2147483658, 2147483648, 2147516545, 2147483648, 32896, 2147483648, 2147483649, 0, 2147516424, 2147483648,
			];
			var BITS = [224, 256, 384, 512];
			var SHAKE_BITS = [128, 256];
			var OUTPUT_TYPES = ['hex', 'buffer', 'arrayBuffer', 'array', 'digest'];
			var CSHAKE_BYTEPAD = {
				128: 168,
				256: 136,
			};
			if (root.JS_SHA3_NO_NODE_JS || !Array.isArray) {
				Array.isArray = function (obj) {
					return Object.prototype.toString.call(obj) === '[object Array]';
				};
			}
			if (ARRAY_BUFFER && (root.JS_SHA3_NO_ARRAY_BUFFER_IS_VIEW || !ArrayBuffer.isView)) {
				ArrayBuffer.isView = function (obj) {
					return typeof obj === 'object' && obj.buffer && obj.buffer.constructor === ArrayBuffer;
				};
			}
			var createOutputMethod = function (bits2, padding2, outputType) {
				return function (message) {
					return new Keccak(bits2, padding2, bits2).update(message)[outputType]();
				};
			};
			var createShakeOutputMethod = function (bits2, padding2, outputType) {
				return function (message, outputBits) {
					return new Keccak(bits2, padding2, outputBits).update(message)[outputType]();
				};
			};
			var createCshakeOutputMethod = function (bits2, padding2, outputType) {
				return function (message, outputBits, n, s) {
					return methods['cshake' + bits2].update(message, outputBits, n, s)[outputType]();
				};
			};
			var createKmacOutputMethod = function (bits2, padding2, outputType) {
				return function (key2, message, outputBits, s) {
					return methods['kmac' + bits2].update(key2, message, outputBits, s)[outputType]();
				};
			};
			var createOutputMethods = function (method, createMethod2, bits2, padding2) {
				for (var i2 = 0; i2 < OUTPUT_TYPES.length; ++i2) {
					var type = OUTPUT_TYPES[i2];
					method[type] = createMethod2(bits2, padding2, type);
				}
				return method;
			};
			var createMethod = function (bits2, padding2) {
				var method = createOutputMethod(bits2, padding2, 'hex');
				method.create = function () {
					return new Keccak(bits2, padding2, bits2);
				};
				method.update = function (message) {
					return method.create().update(message);
				};
				return createOutputMethods(method, createOutputMethod, bits2, padding2);
			};
			var createShakeMethod = function (bits2, padding2) {
				var method = createShakeOutputMethod(bits2, padding2, 'hex');
				method.create = function (outputBits) {
					return new Keccak(bits2, padding2, outputBits);
				};
				method.update = function (message, outputBits) {
					return method.create(outputBits).update(message);
				};
				return createOutputMethods(method, createShakeOutputMethod, bits2, padding2);
			};
			var createCshakeMethod = function (bits2, padding2) {
				var w = CSHAKE_BYTEPAD[bits2];
				var method = createCshakeOutputMethod(bits2, padding2, 'hex');
				method.create = function (outputBits, n, s) {
					if (!n && !s) {
						return methods['shake' + bits2].create(outputBits);
					} else {
						return new Keccak(bits2, padding2, outputBits).bytepad([n, s], w);
					}
				};
				method.update = function (message, outputBits, n, s) {
					return method.create(outputBits, n, s).update(message);
				};
				return createOutputMethods(method, createCshakeOutputMethod, bits2, padding2);
			};
			var createKmacMethod = function (bits2, padding2) {
				var w = CSHAKE_BYTEPAD[bits2];
				var method = createKmacOutputMethod(bits2, padding2, 'hex');
				method.create = function (key2, outputBits, s) {
					return new Kmac(bits2, padding2, outputBits).bytepad(['KMAC', s], w).bytepad([key2], w);
				};
				method.update = function (key2, message, outputBits, s) {
					return method.create(key2, outputBits, s).update(message);
				};
				return createOutputMethods(method, createKmacOutputMethod, bits2, padding2);
			};
			var algorithms = [
				{ name: 'keccak', padding: KECCAK_PADDING, bits: BITS, createMethod },
				{ name: 'sha3', padding: PADDING, bits: BITS, createMethod },
				{ name: 'shake', padding: SHAKE_PADDING, bits: SHAKE_BITS, createMethod: createShakeMethod },
				{ name: 'cshake', padding: CSHAKE_PADDING, bits: SHAKE_BITS, createMethod: createCshakeMethod },
				{ name: 'kmac', padding: CSHAKE_PADDING, bits: SHAKE_BITS, createMethod: createKmacMethod },
			];
			var methods = {},
				methodNames = [];
			for (var i = 0; i < algorithms.length; ++i) {
				var algorithm = algorithms[i];
				var bits = algorithm.bits;
				for (var j = 0; j < bits.length; ++j) {
					var methodName = algorithm.name + '_' + bits[j];
					methodNames.push(methodName);
					methods[methodName] = algorithm.createMethod(bits[j], algorithm.padding);
					if (algorithm.name !== 'sha3') {
						var newMethodName = algorithm.name + bits[j];
						methodNames.push(newMethodName);
						methods[newMethodName] = methods[methodName];
					}
				}
			}
			function Keccak(bits2, padding2, outputBits) {
				this.blocks = [];
				this.s = [];
				this.padding = padding2;
				this.outputBits = outputBits;
				this.reset = true;
				this.finalized = false;
				this.block = 0;
				this.start = 0;
				this.blockCount = (1600 - (bits2 << 1)) >> 5;
				this.byteCount = this.blockCount << 2;
				this.outputBlocks = outputBits >> 5;
				this.extraBytes = (outputBits & 31) >> 3;
				for (var i2 = 0; i2 < 50; ++i2) {
					this.s[i2] = 0;
				}
			}
			Keccak.prototype.update = function (message) {
				if (this.finalized) {
					throw new Error(FINALIZE_ERROR);
				}
				var notString,
					type = typeof message;
				if (type !== 'string') {
					if (type === 'object') {
						if (message === null) {
							throw new Error(INPUT_ERROR);
						} else if (ARRAY_BUFFER && message.constructor === ArrayBuffer) {
							message = new Uint8Array(message);
						} else if (!Array.isArray(message)) {
							if (!ARRAY_BUFFER || !ArrayBuffer.isView(message)) {
								throw new Error(INPUT_ERROR);
							}
						}
					} else {
						throw new Error(INPUT_ERROR);
					}
					notString = true;
				}
				var blocks = this.blocks,
					byteCount = this.byteCount,
					length = message.length,
					blockCount = this.blockCount,
					index = 0,
					s = this.s,
					i2,
					code;
				while (index < length) {
					if (this.reset) {
						this.reset = false;
						blocks[0] = this.block;
						for (i2 = 1; i2 < blockCount + 1; ++i2) {
							blocks[i2] = 0;
						}
					}
					if (notString) {
						for (i2 = this.start; index < length && i2 < byteCount; ++index) {
							blocks[i2 >> 2] |= message[index] << SHIFT[i2++ & 3];
						}
					} else {
						for (i2 = this.start; index < length && i2 < byteCount; ++index) {
							code = message.charCodeAt(index);
							if (code < 128) {
								blocks[i2 >> 2] |= code << SHIFT[i2++ & 3];
							} else if (code < 2048) {
								blocks[i2 >> 2] |= (192 | (code >> 6)) << SHIFT[i2++ & 3];
								blocks[i2 >> 2] |= (128 | (code & 63)) << SHIFT[i2++ & 3];
							} else if (code < 55296 || code >= 57344) {
								blocks[i2 >> 2] |= (224 | (code >> 12)) << SHIFT[i2++ & 3];
								blocks[i2 >> 2] |= (128 | ((code >> 6) & 63)) << SHIFT[i2++ & 3];
								blocks[i2 >> 2] |= (128 | (code & 63)) << SHIFT[i2++ & 3];
							} else {
								code = 65536 + (((code & 1023) << 10) | (message.charCodeAt(++index) & 1023));
								blocks[i2 >> 2] |= (240 | (code >> 18)) << SHIFT[i2++ & 3];
								blocks[i2 >> 2] |= (128 | ((code >> 12) & 63)) << SHIFT[i2++ & 3];
								blocks[i2 >> 2] |= (128 | ((code >> 6) & 63)) << SHIFT[i2++ & 3];
								blocks[i2 >> 2] |= (128 | (code & 63)) << SHIFT[i2++ & 3];
							}
						}
					}
					this.lastByteIndex = i2;
					if (i2 >= byteCount) {
						this.start = i2 - byteCount;
						this.block = blocks[blockCount];
						for (i2 = 0; i2 < blockCount; ++i2) {
							s[i2] ^= blocks[i2];
						}
						f(s);
						this.reset = true;
					} else {
						this.start = i2;
					}
				}
				return this;
			};
			Keccak.prototype.encode = function (x, right) {
				var o = x & 255,
					n = 1;
				var bytes = [o];
				x = x >> 8;
				o = x & 255;
				while (o > 0) {
					bytes.unshift(o);
					x = x >> 8;
					o = x & 255;
					++n;
				}
				if (right) {
					bytes.push(n);
				} else {
					bytes.unshift(n);
				}
				this.update(bytes);
				return bytes.length;
			};
			Keccak.prototype.encodeString = function (str) {
				var notString,
					type = typeof str;
				if (type !== 'string') {
					if (type === 'object') {
						if (str === null) {
							throw new Error(INPUT_ERROR);
						} else if (ARRAY_BUFFER && str.constructor === ArrayBuffer) {
							str = new Uint8Array(str);
						} else if (!Array.isArray(str)) {
							if (!ARRAY_BUFFER || !ArrayBuffer.isView(str)) {
								throw new Error(INPUT_ERROR);
							}
						}
					} else {
						throw new Error(INPUT_ERROR);
					}
					notString = true;
				}
				var bytes = 0,
					length = str.length;
				if (notString) {
					bytes = length;
				} else {
					for (var i2 = 0; i2 < str.length; ++i2) {
						var code = str.charCodeAt(i2);
						if (code < 128) {
							bytes += 1;
						} else if (code < 2048) {
							bytes += 2;
						} else if (code < 55296 || code >= 57344) {
							bytes += 3;
						} else {
							code = 65536 + (((code & 1023) << 10) | (str.charCodeAt(++i2) & 1023));
							bytes += 4;
						}
					}
				}
				bytes += this.encode(bytes * 8);
				this.update(str);
				return bytes;
			};
			Keccak.prototype.bytepad = function (strs, w) {
				var bytes = this.encode(w);
				for (var i2 = 0; i2 < strs.length; ++i2) {
					bytes += this.encodeString(strs[i2]);
				}
				var paddingBytes = w - (bytes % w);
				var zeros = [];
				zeros.length = paddingBytes;
				this.update(zeros);
				return this;
			};
			Keccak.prototype.finalize = function () {
				if (this.finalized) {
					return;
				}
				this.finalized = true;
				var blocks = this.blocks,
					i2 = this.lastByteIndex,
					blockCount = this.blockCount,
					s = this.s;
				blocks[i2 >> 2] |= this.padding[i2 & 3];
				if (this.lastByteIndex === this.byteCount) {
					blocks[0] = blocks[blockCount];
					for (i2 = 1; i2 < blockCount + 1; ++i2) {
						blocks[i2] = 0;
					}
				}
				blocks[blockCount - 1] |= 2147483648;
				for (i2 = 0; i2 < blockCount; ++i2) {
					s[i2] ^= blocks[i2];
				}
				f(s);
			};
			Keccak.prototype.toString = Keccak.prototype.hex = function () {
				this.finalize();
				var blockCount = this.blockCount,
					s = this.s,
					outputBlocks = this.outputBlocks,
					extraBytes = this.extraBytes,
					i2 = 0,
					j2 = 0;
				var hex = '',
					block;
				while (j2 < outputBlocks) {
					for (i2 = 0; i2 < blockCount && j2 < outputBlocks; ++i2, ++j2) {
						block = s[i2];
						hex +=
							HEX_CHARS[(block >> 4) & 15] +
							HEX_CHARS[block & 15] +
							HEX_CHARS[(block >> 12) & 15] +
							HEX_CHARS[(block >> 8) & 15] +
							HEX_CHARS[(block >> 20) & 15] +
							HEX_CHARS[(block >> 16) & 15] +
							HEX_CHARS[(block >> 28) & 15] +
							HEX_CHARS[(block >> 24) & 15];
					}
					if (j2 % blockCount === 0) {
						f(s);
						i2 = 0;
					}
				}
				if (extraBytes) {
					block = s[i2];
					hex += HEX_CHARS[(block >> 4) & 15] + HEX_CHARS[block & 15];
					if (extraBytes > 1) {
						hex += HEX_CHARS[(block >> 12) & 15] + HEX_CHARS[(block >> 8) & 15];
					}
					if (extraBytes > 2) {
						hex += HEX_CHARS[(block >> 20) & 15] + HEX_CHARS[(block >> 16) & 15];
					}
				}
				return hex;
			};
			Keccak.prototype.arrayBuffer = function () {
				this.finalize();
				var blockCount = this.blockCount,
					s = this.s,
					outputBlocks = this.outputBlocks,
					extraBytes = this.extraBytes,
					i2 = 0,
					j2 = 0;
				var bytes = this.outputBits >> 3;
				var buffer;
				if (extraBytes) {
					buffer = new ArrayBuffer((outputBlocks + 1) << 2);
				} else {
					buffer = new ArrayBuffer(bytes);
				}
				var array = new Uint32Array(buffer);
				while (j2 < outputBlocks) {
					for (i2 = 0; i2 < blockCount && j2 < outputBlocks; ++i2, ++j2) {
						array[j2] = s[i2];
					}
					if (j2 % blockCount === 0) {
						f(s);
					}
				}
				if (extraBytes) {
					array[i2] = s[i2];
					buffer = buffer.slice(0, bytes);
				}
				return buffer;
			};
			Keccak.prototype.buffer = Keccak.prototype.arrayBuffer;
			Keccak.prototype.digest = Keccak.prototype.array = function () {
				this.finalize();
				var blockCount = this.blockCount,
					s = this.s,
					outputBlocks = this.outputBlocks,
					extraBytes = this.extraBytes,
					i2 = 0,
					j2 = 0;
				var array = [],
					offset,
					block;
				while (j2 < outputBlocks) {
					for (i2 = 0; i2 < blockCount && j2 < outputBlocks; ++i2, ++j2) {
						offset = j2 << 2;
						block = s[i2];
						array[offset] = block & 255;
						array[offset + 1] = (block >> 8) & 255;
						array[offset + 2] = (block >> 16) & 255;
						array[offset + 3] = (block >> 24) & 255;
					}
					if (j2 % blockCount === 0) {
						f(s);
					}
				}
				if (extraBytes) {
					offset = j2 << 2;
					block = s[i2];
					array[offset] = block & 255;
					if (extraBytes > 1) {
						array[offset + 1] = (block >> 8) & 255;
					}
					if (extraBytes > 2) {
						array[offset + 2] = (block >> 16) & 255;
					}
				}
				return array;
			};
			function Kmac(bits2, padding2, outputBits) {
				Keccak.call(this, bits2, padding2, outputBits);
			}
			Kmac.prototype = new Keccak();
			Kmac.prototype.finalize = function () {
				this.encode(this.outputBits, true);
				return Keccak.prototype.finalize.call(this);
			};
			var f = function (s) {
				var h,
					l,
					n,
					c0,
					c1,
					c2,
					c3,
					c4,
					c5,
					c6,
					c7,
					c8,
					c9,
					b0,
					b1,
					b2,
					b3,
					b4,
					b5,
					b6,
					b7,
					b8,
					b9,
					b10,
					b11,
					b12,
					b13,
					b14,
					b15,
					b16,
					b17,
					b18,
					b19,
					b20,
					b21,
					b22,
					b23,
					b24,
					b25,
					b26,
					b27,
					b28,
					b29,
					b30,
					b31,
					b32,
					b33,
					b34,
					b35,
					b36,
					b37,
					b38,
					b39,
					b40,
					b41,
					b42,
					b43,
					b44,
					b45,
					b46,
					b47,
					b48,
					b49;
				for (n = 0; n < 48; n += 2) {
					c0 = s[0] ^ s[10] ^ s[20] ^ s[30] ^ s[40];
					c1 = s[1] ^ s[11] ^ s[21] ^ s[31] ^ s[41];
					c2 = s[2] ^ s[12] ^ s[22] ^ s[32] ^ s[42];
					c3 = s[3] ^ s[13] ^ s[23] ^ s[33] ^ s[43];
					c4 = s[4] ^ s[14] ^ s[24] ^ s[34] ^ s[44];
					c5 = s[5] ^ s[15] ^ s[25] ^ s[35] ^ s[45];
					c6 = s[6] ^ s[16] ^ s[26] ^ s[36] ^ s[46];
					c7 = s[7] ^ s[17] ^ s[27] ^ s[37] ^ s[47];
					c8 = s[8] ^ s[18] ^ s[28] ^ s[38] ^ s[48];
					c9 = s[9] ^ s[19] ^ s[29] ^ s[39] ^ s[49];
					h = c8 ^ ((c2 << 1) | (c3 >>> 31));
					l = c9 ^ ((c3 << 1) | (c2 >>> 31));
					s[0] ^= h;
					s[1] ^= l;
					s[10] ^= h;
					s[11] ^= l;
					s[20] ^= h;
					s[21] ^= l;
					s[30] ^= h;
					s[31] ^= l;
					s[40] ^= h;
					s[41] ^= l;
					h = c0 ^ ((c4 << 1) | (c5 >>> 31));
					l = c1 ^ ((c5 << 1) | (c4 >>> 31));
					s[2] ^= h;
					s[3] ^= l;
					s[12] ^= h;
					s[13] ^= l;
					s[22] ^= h;
					s[23] ^= l;
					s[32] ^= h;
					s[33] ^= l;
					s[42] ^= h;
					s[43] ^= l;
					h = c2 ^ ((c6 << 1) | (c7 >>> 31));
					l = c3 ^ ((c7 << 1) | (c6 >>> 31));
					s[4] ^= h;
					s[5] ^= l;
					s[14] ^= h;
					s[15] ^= l;
					s[24] ^= h;
					s[25] ^= l;
					s[34] ^= h;
					s[35] ^= l;
					s[44] ^= h;
					s[45] ^= l;
					h = c4 ^ ((c8 << 1) | (c9 >>> 31));
					l = c5 ^ ((c9 << 1) | (c8 >>> 31));
					s[6] ^= h;
					s[7] ^= l;
					s[16] ^= h;
					s[17] ^= l;
					s[26] ^= h;
					s[27] ^= l;
					s[36] ^= h;
					s[37] ^= l;
					s[46] ^= h;
					s[47] ^= l;
					h = c6 ^ ((c0 << 1) | (c1 >>> 31));
					l = c7 ^ ((c1 << 1) | (c0 >>> 31));
					s[8] ^= h;
					s[9] ^= l;
					s[18] ^= h;
					s[19] ^= l;
					s[28] ^= h;
					s[29] ^= l;
					s[38] ^= h;
					s[39] ^= l;
					s[48] ^= h;
					s[49] ^= l;
					b0 = s[0];
					b1 = s[1];
					b32 = (s[11] << 4) | (s[10] >>> 28);
					b33 = (s[10] << 4) | (s[11] >>> 28);
					b14 = (s[20] << 3) | (s[21] >>> 29);
					b15 = (s[21] << 3) | (s[20] >>> 29);
					b46 = (s[31] << 9) | (s[30] >>> 23);
					b47 = (s[30] << 9) | (s[31] >>> 23);
					b28 = (s[40] << 18) | (s[41] >>> 14);
					b29 = (s[41] << 18) | (s[40] >>> 14);
					b20 = (s[2] << 1) | (s[3] >>> 31);
					b21 = (s[3] << 1) | (s[2] >>> 31);
					b2 = (s[13] << 12) | (s[12] >>> 20);
					b3 = (s[12] << 12) | (s[13] >>> 20);
					b34 = (s[22] << 10) | (s[23] >>> 22);
					b35 = (s[23] << 10) | (s[22] >>> 22);
					b16 = (s[33] << 13) | (s[32] >>> 19);
					b17 = (s[32] << 13) | (s[33] >>> 19);
					b48 = (s[42] << 2) | (s[43] >>> 30);
					b49 = (s[43] << 2) | (s[42] >>> 30);
					b40 = (s[5] << 30) | (s[4] >>> 2);
					b41 = (s[4] << 30) | (s[5] >>> 2);
					b22 = (s[14] << 6) | (s[15] >>> 26);
					b23 = (s[15] << 6) | (s[14] >>> 26);
					b4 = (s[25] << 11) | (s[24] >>> 21);
					b5 = (s[24] << 11) | (s[25] >>> 21);
					b36 = (s[34] << 15) | (s[35] >>> 17);
					b37 = (s[35] << 15) | (s[34] >>> 17);
					b18 = (s[45] << 29) | (s[44] >>> 3);
					b19 = (s[44] << 29) | (s[45] >>> 3);
					b10 = (s[6] << 28) | (s[7] >>> 4);
					b11 = (s[7] << 28) | (s[6] >>> 4);
					b42 = (s[17] << 23) | (s[16] >>> 9);
					b43 = (s[16] << 23) | (s[17] >>> 9);
					b24 = (s[26] << 25) | (s[27] >>> 7);
					b25 = (s[27] << 25) | (s[26] >>> 7);
					b6 = (s[36] << 21) | (s[37] >>> 11);
					b7 = (s[37] << 21) | (s[36] >>> 11);
					b38 = (s[47] << 24) | (s[46] >>> 8);
					b39 = (s[46] << 24) | (s[47] >>> 8);
					b30 = (s[8] << 27) | (s[9] >>> 5);
					b31 = (s[9] << 27) | (s[8] >>> 5);
					b12 = (s[18] << 20) | (s[19] >>> 12);
					b13 = (s[19] << 20) | (s[18] >>> 12);
					b44 = (s[29] << 7) | (s[28] >>> 25);
					b45 = (s[28] << 7) | (s[29] >>> 25);
					b26 = (s[38] << 8) | (s[39] >>> 24);
					b27 = (s[39] << 8) | (s[38] >>> 24);
					b8 = (s[48] << 14) | (s[49] >>> 18);
					b9 = (s[49] << 14) | (s[48] >>> 18);
					s[0] = b0 ^ (~b2 & b4);
					s[1] = b1 ^ (~b3 & b5);
					s[10] = b10 ^ (~b12 & b14);
					s[11] = b11 ^ (~b13 & b15);
					s[20] = b20 ^ (~b22 & b24);
					s[21] = b21 ^ (~b23 & b25);
					s[30] = b30 ^ (~b32 & b34);
					s[31] = b31 ^ (~b33 & b35);
					s[40] = b40 ^ (~b42 & b44);
					s[41] = b41 ^ (~b43 & b45);
					s[2] = b2 ^ (~b4 & b6);
					s[3] = b3 ^ (~b5 & b7);
					s[12] = b12 ^ (~b14 & b16);
					s[13] = b13 ^ (~b15 & b17);
					s[22] = b22 ^ (~b24 & b26);
					s[23] = b23 ^ (~b25 & b27);
					s[32] = b32 ^ (~b34 & b36);
					s[33] = b33 ^ (~b35 & b37);
					s[42] = b42 ^ (~b44 & b46);
					s[43] = b43 ^ (~b45 & b47);
					s[4] = b4 ^ (~b6 & b8);
					s[5] = b5 ^ (~b7 & b9);
					s[14] = b14 ^ (~b16 & b18);
					s[15] = b15 ^ (~b17 & b19);
					s[24] = b24 ^ (~b26 & b28);
					s[25] = b25 ^ (~b27 & b29);
					s[34] = b34 ^ (~b36 & b38);
					s[35] = b35 ^ (~b37 & b39);
					s[44] = b44 ^ (~b46 & b48);
					s[45] = b45 ^ (~b47 & b49);
					s[6] = b6 ^ (~b8 & b0);
					s[7] = b7 ^ (~b9 & b1);
					s[16] = b16 ^ (~b18 & b10);
					s[17] = b17 ^ (~b19 & b11);
					s[26] = b26 ^ (~b28 & b20);
					s[27] = b27 ^ (~b29 & b21);
					s[36] = b36 ^ (~b38 & b30);
					s[37] = b37 ^ (~b39 & b31);
					s[46] = b46 ^ (~b48 & b40);
					s[47] = b47 ^ (~b49 & b41);
					s[8] = b8 ^ (~b0 & b2);
					s[9] = b9 ^ (~b1 & b3);
					s[18] = b18 ^ (~b10 & b12);
					s[19] = b19 ^ (~b11 & b13);
					s[28] = b28 ^ (~b20 & b22);
					s[29] = b29 ^ (~b21 & b23);
					s[38] = b38 ^ (~b30 & b32);
					s[39] = b39 ^ (~b31 & b33);
					s[48] = b48 ^ (~b40 & b42);
					s[49] = b49 ^ (~b41 & b43);
					s[0] ^= RC[n];
					s[1] ^= RC[n + 1];
				}
			};
			if (COMMON_JS) {
				module.exports = methods;
			} else {
				for (i = 0; i < methodNames.length; ++i) {
					root[methodNames[i]] = methods[methodNames[i]];
				}
			}
		})();
	})(sha3$1);
	return sha3$1.exports;
}
var sha3Exports = requireSha3();
const sha3 = /* @__PURE__ */ getDefaultExportFromCjs(sha3Exports);
function keccak256(data) {
	return '0x' + sha3.keccak_256(arrayify(data));
}
const AddressZero = '0x0000000000000000000000000000000000000000';
const Zero$1 = /* @__PURE__ */ BigNumber.from(0);
const HashZero = '0x0000000000000000000000000000000000000000000000000000000000000000';
const version$b = 'strings/5.8.0';
const logger$e = new Logger(version$b);
var UnicodeNormalizationForm;
(function (UnicodeNormalizationForm2) {
	UnicodeNormalizationForm2['current'] = '';
	UnicodeNormalizationForm2['NFC'] = 'NFC';
	UnicodeNormalizationForm2['NFD'] = 'NFD';
	UnicodeNormalizationForm2['NFKC'] = 'NFKC';
	UnicodeNormalizationForm2['NFKD'] = 'NFKD';
})(UnicodeNormalizationForm || (UnicodeNormalizationForm = {}));
var Utf8ErrorReason;
(function (Utf8ErrorReason2) {
	Utf8ErrorReason2['UNEXPECTED_CONTINUE'] = 'unexpected continuation byte';
	Utf8ErrorReason2['BAD_PREFIX'] = 'bad codepoint prefix';
	Utf8ErrorReason2['OVERRUN'] = 'string overrun';
	Utf8ErrorReason2['MISSING_CONTINUE'] = 'missing continuation byte';
	Utf8ErrorReason2['OUT_OF_RANGE'] = 'out of UTF-8 range';
	Utf8ErrorReason2['UTF16_SURROGATE'] = 'UTF-16 surrogate';
	Utf8ErrorReason2['OVERLONG'] = 'overlong representation';
})(Utf8ErrorReason || (Utf8ErrorReason = {}));
function errorFunc(reason, offset, bytes, output, badCodepoint) {
	return logger$e.throwArgumentError(`invalid codepoint at offset ${offset}; ${reason}`, 'bytes', bytes);
}
function ignoreFunc(reason, offset, bytes, output, badCodepoint) {
	if (reason === Utf8ErrorReason.BAD_PREFIX || reason === Utf8ErrorReason.UNEXPECTED_CONTINUE) {
		let i = 0;
		for (let o = offset + 1; o < bytes.length; o++) {
			if (bytes[o] >> 6 !== 2) {
				break;
			}
			i++;
		}
		return i;
	}
	if (reason === Utf8ErrorReason.OVERRUN) {
		return bytes.length - offset - 1;
	}
	return 0;
}
function replaceFunc(reason, offset, bytes, output, badCodepoint) {
	if (reason === Utf8ErrorReason.OVERLONG) {
		output.push(badCodepoint);
		return 0;
	}
	output.push(65533);
	return ignoreFunc(reason, offset, bytes);
}
const Utf8ErrorFuncs = Object.freeze({
	error: errorFunc,
	ignore: ignoreFunc,
	replace: replaceFunc,
});
function getUtf8CodePoints(bytes, onError) {
	if (onError == null) {
		onError = Utf8ErrorFuncs.error;
	}
	bytes = arrayify(bytes);
	const result = [];
	let i = 0;
	while (i < bytes.length) {
		const c = bytes[i++];
		if (c >> 7 === 0) {
			result.push(c);
			continue;
		}
		let extraLength = null;
		let overlongMask = null;
		if ((c & 224) === 192) {
			extraLength = 1;
			overlongMask = 127;
		} else if ((c & 240) === 224) {
			extraLength = 2;
			overlongMask = 2047;
		} else if ((c & 248) === 240) {
			extraLength = 3;
			overlongMask = 65535;
		} else {
			if ((c & 192) === 128) {
				i += onError(Utf8ErrorReason.UNEXPECTED_CONTINUE, i - 1, bytes, result);
			} else {
				i += onError(Utf8ErrorReason.BAD_PREFIX, i - 1, bytes, result);
			}
			continue;
		}
		if (i - 1 + extraLength >= bytes.length) {
			i += onError(Utf8ErrorReason.OVERRUN, i - 1, bytes, result);
			continue;
		}
		let res = c & ((1 << (8 - extraLength - 1)) - 1);
		for (let j = 0; j < extraLength; j++) {
			let nextChar = bytes[i];
			if ((nextChar & 192) != 128) {
				i += onError(Utf8ErrorReason.MISSING_CONTINUE, i, bytes, result);
				res = null;
				break;
			}
			res = (res << 6) | (nextChar & 63);
			i++;
		}
		if (res === null) {
			continue;
		}
		if (res > 1114111) {
			i += onError(Utf8ErrorReason.OUT_OF_RANGE, i - 1 - extraLength, bytes, result, res);
			continue;
		}
		if (res >= 55296 && res <= 57343) {
			i += onError(Utf8ErrorReason.UTF16_SURROGATE, i - 1 - extraLength, bytes, result, res);
			continue;
		}
		if (res <= overlongMask) {
			i += onError(Utf8ErrorReason.OVERLONG, i - 1 - extraLength, bytes, result, res);
			continue;
		}
		result.push(res);
	}
	return result;
}
function toUtf8Bytes(str, form = UnicodeNormalizationForm.current) {
	if (form != UnicodeNormalizationForm.current) {
		logger$e.checkNormalize();
		str = str.normalize(form);
	}
	let result = [];
	for (let i = 0; i < str.length; i++) {
		const c = str.charCodeAt(i);
		if (c < 128) {
			result.push(c);
		} else if (c < 2048) {
			result.push((c >> 6) | 192);
			result.push((c & 63) | 128);
		} else if ((c & 64512) == 55296) {
			i++;
			const c2 = str.charCodeAt(i);
			if (i >= str.length || (c2 & 64512) !== 56320) {
				throw new Error('invalid utf-8 string');
			}
			const pair = 65536 + ((c & 1023) << 10) + (c2 & 1023);
			result.push((pair >> 18) | 240);
			result.push(((pair >> 12) & 63) | 128);
			result.push(((pair >> 6) & 63) | 128);
			result.push((pair & 63) | 128);
		} else {
			result.push((c >> 12) | 224);
			result.push(((c >> 6) & 63) | 128);
			result.push((c & 63) | 128);
		}
	}
	return arrayify(result);
}
function _toUtf8String(codePoints) {
	return codePoints
		.map((codePoint) => {
			if (codePoint <= 65535) {
				return String.fromCharCode(codePoint);
			}
			codePoint -= 65536;
			return String.fromCharCode(((codePoint >> 10) & 1023) + 55296, (codePoint & 1023) + 56320);
		})
		.join('');
}
function toUtf8String(bytes, onError) {
	return _toUtf8String(getUtf8CodePoints(bytes, onError));
}
function toUtf8CodePoints(str, form = UnicodeNormalizationForm.current) {
	return getUtf8CodePoints(toUtf8Bytes(str, form));
}
function id(text) {
	return keccak256(toUtf8Bytes(text));
}
const version$a = 'hash/5.8.0';
function decode$1(textData) {
	textData = atob(textData);
	const data = [];
	for (let i = 0; i < textData.length; i++) {
		data.push(textData.charCodeAt(i));
	}
	return arrayify(data);
}
function encode$1(data) {
	data = arrayify(data);
	let textData = '';
	for (let i = 0; i < data.length; i++) {
		textData += String.fromCharCode(data[i]);
	}
	return btoa(textData);
}
function flat(array, depth) {
	if (depth == null) {
		depth = 1;
	}
	const result = [];
	const forEach = result.forEach;
	const flatDeep = function (arr, depth2) {
		forEach.call(arr, function (val) {
			if (depth2 > 0 && Array.isArray(val)) {
				flatDeep(val, depth2 - 1);
			} else {
				result.push(val);
			}
		});
	};
	flatDeep(array, depth);
	return result;
}
function fromEntries(array) {
	const result = {};
	for (let i = 0; i < array.length; i++) {
		const value = array[i];
		result[value[0]] = value[1];
	}
	return result;
}
function decode_arithmetic(bytes) {
	let pos = 0;
	function u16() {
		return (bytes[pos++] << 8) | bytes[pos++];
	}
	let symbol_count = u16();
	let total = 1;
	let acc = [0, 1];
	for (let i = 1; i < symbol_count; i++) {
		acc.push((total += u16()));
	}
	let skip = u16();
	let pos_payload = pos;
	pos += skip;
	let read_width = 0;
	let read_buffer = 0;
	function read_bit() {
		if (read_width == 0) {
			read_buffer = (read_buffer << 8) | bytes[pos++];
			read_width = 8;
		}
		return (read_buffer >> --read_width) & 1;
	}
	const N = 31;
	const FULL = Math.pow(2, N);
	const HALF = FULL >>> 1;
	const QRTR = HALF >> 1;
	const MASK = FULL - 1;
	let register = 0;
	for (let i = 0; i < N; i++) register = (register << 1) | read_bit();
	let symbols = [];
	let low = 0;
	let range = FULL;
	while (true) {
		let value = Math.floor(((register - low + 1) * total - 1) / range);
		let start = 0;
		let end = symbol_count;
		while (end - start > 1) {
			let mid = (start + end) >>> 1;
			if (value < acc[mid]) {
				end = mid;
			} else {
				start = mid;
			}
		}
		if (start == 0) break;
		symbols.push(start);
		let a = low + Math.floor((range * acc[start]) / total);
		let b = low + Math.floor((range * acc[start + 1]) / total) - 1;
		while (((a ^ b) & HALF) == 0) {
			register = ((register << 1) & MASK) | read_bit();
			a = (a << 1) & MASK;
			b = ((b << 1) & MASK) | 1;
		}
		while (a & ~b & QRTR) {
			register = (register & HALF) | ((register << 1) & (MASK >>> 1)) | read_bit();
			a = (a << 1) ^ HALF;
			b = ((b ^ HALF) << 1) | HALF | 1;
		}
		low = a;
		range = 1 + b - a;
	}
	let offset = symbol_count - 4;
	return symbols.map((x) => {
		switch (x - offset) {
			case 3:
				return offset + 65792 + ((bytes[pos_payload++] << 16) | (bytes[pos_payload++] << 8) | bytes[pos_payload++]);
			case 2:
				return offset + 256 + ((bytes[pos_payload++] << 8) | bytes[pos_payload++]);
			case 1:
				return offset + bytes[pos_payload++];
			default:
				return x - 1;
		}
	});
}
function read_payload(v) {
	let pos = 0;
	return () => v[pos++];
}
function read_compressed_payload(bytes) {
	return read_payload(decode_arithmetic(bytes));
}
function signed(i) {
	return i & 1 ? ~i >> 1 : i >> 1;
}
function read_counts(n, next) {
	let v = Array(n);
	for (let i = 0; i < n; i++) v[i] = 1 + next();
	return v;
}
function read_ascending(n, next) {
	let v = Array(n);
	for (let i = 0, x = -1; i < n; i++) v[i] = x += 1 + next();
	return v;
}
function read_deltas(n, next) {
	let v = Array(n);
	for (let i = 0, x = 0; i < n; i++) v[i] = x += signed(next());
	return v;
}
function read_member_array(next, lookup) {
	let v = read_ascending(next(), next);
	let n = next();
	let vX = read_ascending(n, next);
	let vN = read_counts(n, next);
	for (let i = 0; i < n; i++) {
		for (let j = 0; j < vN[i]; j++) {
			v.push(vX[i] + j);
		}
	}
	return lookup ? v.map((x) => lookup[x]) : v;
}
function read_mapped_map(next) {
	let ret = [];
	while (true) {
		let w = next();
		if (w == 0) break;
		ret.push(read_linear_table(w, next));
	}
	while (true) {
		let w = next() - 1;
		if (w < 0) break;
		ret.push(read_replacement_table(w, next));
	}
	return fromEntries(flat(ret));
}
function read_zero_terminated_array(next) {
	let v = [];
	while (true) {
		let i = next();
		if (i == 0) break;
		v.push(i);
	}
	return v;
}
function read_transposed(n, w, next) {
	let m = Array(n)
		.fill(void 0)
		.map(() => []);
	for (let i = 0; i < w; i++) {
		read_deltas(n, next).forEach((x, j) => m[j].push(x));
	}
	return m;
}
function read_linear_table(w, next) {
	let dx = 1 + next();
	let dy = next();
	let vN = read_zero_terminated_array(next);
	let m = read_transposed(vN.length, 1 + w, next);
	return flat(
		m.map((v, i) => {
			const x = v[0],
				ys = v.slice(1);
			return Array(vN[i])
				.fill(void 0)
				.map((_, j) => {
					let j_dy = j * dy;
					return [x + j * dx, ys.map((y) => y + j_dy)];
				});
		}),
	);
}
function read_replacement_table(w, next) {
	let n = 1 + next();
	let m = read_transposed(n, 1 + w, next);
	return m.map((v) => [v[0], v.slice(1)]);
}
function read_emoji_trie(next) {
	let sorted = read_member_array(next).sort((a, b) => a - b);
	return read();
	function read() {
		let branches = [];
		while (true) {
			let keys = read_member_array(next, sorted);
			if (keys.length == 0) break;
			branches.push({ set: new Set(keys), node: read() });
		}
		branches.sort((a, b) => b.set.size - a.set.size);
		let temp = next();
		let valid = temp % 3;
		temp = (temp / 3) | 0;
		let fe0f = !!(temp & 1);
		temp >>= 1;
		let save = temp == 1;
		let check = temp == 2;
		return { branches, valid, fe0f, save, check };
	}
}
function getData() {
	return read_compressed_payload(
		decode$1(
			'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',
		),
	);
}
const r = getData();
const VALID = new Set(read_member_array(r));
const IGNORED = new Set(read_member_array(r));
const MAPPED = read_mapped_map(r);
const EMOJI_ROOT = read_emoji_trie(r);
const HYPHEN = 45;
const UNDERSCORE = 95;
function explode_cp(name) {
	return toUtf8CodePoints(name);
}
function filter_fe0f(cps) {
	return cps.filter((cp) => cp != 65039);
}
function ens_normalize_post_check(name) {
	for (let label of name.split('.')) {
		let cps = explode_cp(label);
		try {
			for (let i = cps.lastIndexOf(UNDERSCORE) - 1; i >= 0; i--) {
				if (cps[i] !== UNDERSCORE) {
					throw new Error(`underscore only allowed at start`);
				}
			}
			if (cps.length >= 4 && cps.every((cp) => cp < 128) && cps[2] === HYPHEN && cps[3] === HYPHEN) {
				throw new Error(`invalid label extension`);
			}
		} catch (err) {
			throw new Error(`Invalid label "${label}": ${err.message}`);
		}
	}
	return name;
}
function ens_normalize(name) {
	return ens_normalize_post_check(normalize(name, filter_fe0f));
}
function normalize(name, emoji_filter) {
	let input = explode_cp(name).reverse();
	let output = [];
	while (input.length) {
		let emoji = consume_emoji_reversed(input);
		if (emoji) {
			output.push(...emoji_filter(emoji));
			continue;
		}
		let cp = input.pop();
		if (VALID.has(cp)) {
			output.push(cp);
			continue;
		}
		if (IGNORED.has(cp)) {
			continue;
		}
		let cps = MAPPED[cp];
		if (cps) {
			output.push(...cps);
			continue;
		}
		throw new Error(`Disallowed codepoint: 0x${cp.toString(16).toUpperCase()}`);
	}
	return ens_normalize_post_check(nfc(String.fromCodePoint(...output)));
}
function nfc(s) {
	return s.normalize('NFC');
}
function consume_emoji_reversed(cps, eaten) {
	var _a;
	let node = EMOJI_ROOT;
	let emoji;
	let saved;
	let stack = [];
	let pos = cps.length;
	while (pos) {
		let cp = cps[--pos];
		node = (_a = node.branches.find((x) => x.set.has(cp))) === null || _a === void 0 ? void 0 : _a.node;
		if (!node) break;
		if (node.save) {
			saved = cp;
		} else if (node.check) {
			if (cp === saved) break;
		}
		stack.push(cp);
		if (node.fe0f) {
			stack.push(65039);
			if (pos > 0 && cps[pos - 1] == 65039) pos--;
		}
		if (node.valid) {
			emoji = stack.slice();
			if (node.valid == 2) emoji.splice(1, 1);
			cps.length = pos;
		}
	}
	return emoji;
}
const logger$d = new Logger(version$a);
const Zeros = new Uint8Array(32);
Zeros.fill(0);
function checkComponent(comp) {
	if (comp.length === 0) {
		throw new Error('invalid ENS name; empty component');
	}
	return comp;
}
function ensNameSplit(name) {
	const bytes = toUtf8Bytes(ens_normalize(name));
	const comps = [];
	if (name.length === 0) {
		return comps;
	}
	let last = 0;
	for (let i = 0; i < bytes.length; i++) {
		const d = bytes[i];
		if (d === 46) {
			comps.push(checkComponent(bytes.slice(last, i)));
			last = i + 1;
		}
	}
	if (last >= bytes.length) {
		throw new Error('invalid ENS name; empty component');
	}
	comps.push(checkComponent(bytes.slice(last)));
	return comps;
}
function namehash(name) {
	if (typeof name !== 'string') {
		logger$d.throwArgumentError('invalid ENS name; not a string', 'name', name);
	}
	let result = Zeros;
	const comps = ensNameSplit(name);
	while (comps.length) {
		result = keccak256(concat([result, keccak256(comps.pop())]));
	}
	return hexlify(result);
}
function dnsEncode(name) {
	return (
		hexlify(
			concat(
				ensNameSplit(name).map((comp) => {
					if (comp.length > 63) {
						throw new Error('invalid DNS encoded entry; length exceeds 63 bytes');
					}
					const bytes = new Uint8Array(comp.length + 1);
					bytes.set(comp, 1);
					bytes[0] = bytes.length - 1;
					return bytes;
				}),
			),
		) + '00'
	);
}
const version$9 = 'rlp/5.8.0';
const logger$c = new Logger(version$9);
function arrayifyInteger(value) {
	const result = [];
	while (value) {
		result.unshift(value & 255);
		value >>= 8;
	}
	return result;
}
function unarrayifyInteger(data, offset, length) {
	let result = 0;
	for (let i = 0; i < length; i++) {
		result = result * 256 + data[offset + i];
	}
	return result;
}
function _encode(object) {
	if (Array.isArray(object)) {
		let payload = [];
		object.forEach(function (child) {
			payload = payload.concat(_encode(child));
		});
		if (payload.length <= 55) {
			payload.unshift(192 + payload.length);
			return payload;
		}
		const length2 = arrayifyInteger(payload.length);
		length2.unshift(247 + length2.length);
		return length2.concat(payload);
	}
	if (!isBytesLike(object)) {
		logger$c.throwArgumentError('RLP object must be BytesLike', 'object', object);
	}
	const data = Array.prototype.slice.call(arrayify(object));
	if (data.length === 1 && data[0] <= 127) {
		return data;
	} else if (data.length <= 55) {
		data.unshift(128 + data.length);
		return data;
	}
	const length = arrayifyInteger(data.length);
	length.unshift(183 + length.length);
	return length.concat(data);
}
function encode(object) {
	return hexlify(_encode(object));
}
function _decodeChildren(data, offset, childOffset, length) {
	const result = [];
	while (childOffset < offset + 1 + length) {
		const decoded = _decode(data, childOffset);
		result.push(decoded.result);
		childOffset += decoded.consumed;
		if (childOffset > offset + 1 + length) {
			logger$c.throwError('child data too short', Logger.errors.BUFFER_OVERRUN, {});
		}
	}
	return { consumed: 1 + length, result };
}
function _decode(data, offset) {
	if (data.length === 0) {
		logger$c.throwError('data too short', Logger.errors.BUFFER_OVERRUN, {});
	}
	if (data[offset] >= 248) {
		const lengthLength = data[offset] - 247;
		if (offset + 1 + lengthLength > data.length) {
			logger$c.throwError('data short segment too short', Logger.errors.BUFFER_OVERRUN, {});
		}
		const length = unarrayifyInteger(data, offset + 1, lengthLength);
		if (offset + 1 + lengthLength + length > data.length) {
			logger$c.throwError('data long segment too short', Logger.errors.BUFFER_OVERRUN, {});
		}
		return _decodeChildren(data, offset, offset + 1 + lengthLength, lengthLength + length);
	} else if (data[offset] >= 192) {
		const length = data[offset] - 192;
		if (offset + 1 + length > data.length) {
			logger$c.throwError('data array too short', Logger.errors.BUFFER_OVERRUN, {});
		}
		return _decodeChildren(data, offset, offset + 1, length);
	} else if (data[offset] >= 184) {
		const lengthLength = data[offset] - 183;
		if (offset + 1 + lengthLength > data.length) {
			logger$c.throwError('data array too short', Logger.errors.BUFFER_OVERRUN, {});
		}
		const length = unarrayifyInteger(data, offset + 1, lengthLength);
		if (offset + 1 + lengthLength + length > data.length) {
			logger$c.throwError('data array too short', Logger.errors.BUFFER_OVERRUN, {});
		}
		const result = hexlify(data.slice(offset + 1 + lengthLength, offset + 1 + lengthLength + length));
		return { consumed: 1 + lengthLength + length, result };
	} else if (data[offset] >= 128) {
		const length = data[offset] - 128;
		if (offset + 1 + length > data.length) {
			logger$c.throwError('data too short', Logger.errors.BUFFER_OVERRUN, {});
		}
		const result = hexlify(data.slice(offset + 1, offset + 1 + length));
		return { consumed: 1 + length, result };
	}
	return { consumed: 1, result: hexlify(data[offset]) };
}
function decode(data) {
	const bytes = arrayify(data);
	const decoded = _decode(bytes, 0);
	if (decoded.consumed !== bytes.length) {
		logger$c.throwArgumentError('invalid rlp data', 'data', data);
	}
	return decoded.result;
}
const version$8 = 'address/5.8.0';
const logger$b = new Logger(version$8);
function getChecksumAddress(address) {
	if (!isHexString(address, 20)) {
		logger$b.throwArgumentError('invalid address', 'address', address);
	}
	address = address.toLowerCase();
	const chars = address.substring(2).split('');
	const expanded = new Uint8Array(40);
	for (let i = 0; i < 40; i++) {
		expanded[i] = chars[i].charCodeAt(0);
	}
	const hashed = arrayify(keccak256(expanded));
	for (let i = 0; i < 40; i += 2) {
		if (hashed[i >> 1] >> 4 >= 8) {
			chars[i] = chars[i].toUpperCase();
		}
		if ((hashed[i >> 1] & 15) >= 8) {
			chars[i + 1] = chars[i + 1].toUpperCase();
		}
	}
	return '0x' + chars.join('');
}
const MAX_SAFE_INTEGER = 9007199254740991;
function log10(x) {
	if (Math.log10) {
		return Math.log10(x);
	}
	return Math.log(x) / Math.LN10;
}
const ibanLookup = {};
for (let i = 0; i < 10; i++) {
	ibanLookup[String(i)] = String(i);
}
for (let i = 0; i < 26; i++) {
	ibanLookup[String.fromCharCode(65 + i)] = String(10 + i);
}
const safeDigits = Math.floor(log10(MAX_SAFE_INTEGER));
function ibanChecksum(address) {
	address = address.toUpperCase();
	address = address.substring(4) + address.substring(0, 2) + '00';
	let expanded = address
		.split('')
		.map((c) => {
			return ibanLookup[c];
		})
		.join('');
	while (expanded.length >= safeDigits) {
		let block = expanded.substring(0, safeDigits);
		expanded = (parseInt(block, 10) % 97) + expanded.substring(block.length);
	}
	let checksum = String(98 - (parseInt(expanded, 10) % 97));
	while (checksum.length < 2) {
		checksum = '0' + checksum;
	}
	return checksum;
}
function getAddress(address) {
	let result = null;
	if (typeof address !== 'string') {
		logger$b.throwArgumentError('invalid address', 'address', address);
	}
	if (address.match(/^(0x)?[0-9a-fA-F]{40}$/)) {
		if (address.substring(0, 2) !== '0x') {
			address = '0x' + address;
		}
		result = getChecksumAddress(address);
		if (address.match(/([A-F].*[a-f])|([a-f].*[A-F])/) && result !== address) {
			logger$b.throwArgumentError('bad address checksum', 'address', address);
		}
	} else if (address.match(/^XE[0-9]{2}[0-9A-Za-z]{30,31}$/)) {
		if (address.substring(2, 4) !== ibanChecksum(address)) {
			logger$b.throwArgumentError('bad icap checksum', 'address', address);
		}
		result = _base36To16(address.substring(4));
		while (result.length < 40) {
			result = '0' + result;
		}
		result = getChecksumAddress('0x' + result);
	} else {
		logger$b.throwArgumentError('invalid address', 'address', address);
	}
	return result;
}
function getContractAddress(transaction) {
	let from = null;
	try {
		from = getAddress(transaction.from);
	} catch (error) {
		logger$b.throwArgumentError('missing from address', 'transaction', transaction);
	}
	const nonce = stripZeros(arrayify(BigNumber.from(transaction.nonce).toHexString()));
	return getAddress(hexDataSlice(keccak256(encode([from, nonce])), 12));
}
const version$7 = 'properties/5.8.0';
var __awaiter$7 = function (thisArg, _arguments, P, generator) {
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
const logger$a = new Logger(version$7);
function defineReadOnly(object, name, value) {
	Object.defineProperty(object, name, {
		enumerable: true,
		value,
		writable: false,
	});
}
function getStatic(ctor, key2) {
	for (let i = 0; i < 32; i++) {
		if (ctor[key2]) {
			return ctor[key2];
		}
		if (!ctor.prototype || typeof ctor.prototype !== 'object') {
			break;
		}
		ctor = Object.getPrototypeOf(ctor.prototype).constructor;
	}
	return null;
}
function resolveProperties(object) {
	return __awaiter$7(this, void 0, void 0, function* () {
		const promises = Object.keys(object).map((key2) => {
			const value = object[key2];
			return Promise.resolve(value).then((v) => ({ key: key2, value: v }));
		});
		const results = yield Promise.all(promises);
		return results.reduce((accum, result) => {
			accum[result.key] = result.value;
			return accum;
		}, {});
	});
}
function checkProperties(object, properties) {
	if (!object || typeof object !== 'object') {
		logger$a.throwArgumentError('invalid object', 'object', object);
	}
	Object.keys(object).forEach((key2) => {
		if (!properties[key2]) {
			logger$a.throwArgumentError('invalid object key - ' + key2, 'transaction:' + key2, object);
		}
	});
}
function shallowCopy(object) {
	const result = {};
	for (const key2 in object) {
		result[key2] = object[key2];
	}
	return result;
}
const opaque = { bigint: true, boolean: true, function: true, number: true, string: true };
function _isFrozen(object) {
	if (object === void 0 || object === null || opaque[typeof object]) {
		return true;
	}
	if (Array.isArray(object) || typeof object === 'object') {
		if (!Object.isFrozen(object)) {
			return false;
		}
		const keys = Object.keys(object);
		for (let i = 0; i < keys.length; i++) {
			let value = null;
			try {
				value = object[keys[i]];
			} catch (error) {
				continue;
			}
			if (!_isFrozen(value)) {
				return false;
			}
		}
		return true;
	}
	return logger$a.throwArgumentError(`Cannot deepCopy ${typeof object}`, 'object', object);
}
function _deepCopy(object) {
	if (_isFrozen(object)) {
		return object;
	}
	if (Array.isArray(object)) {
		return Object.freeze(object.map((item) => deepCopy(item)));
	}
	if (typeof object === 'object') {
		const result = {};
		for (const key2 in object) {
			const value = object[key2];
			if (value === void 0) {
				continue;
			}
			defineReadOnly(result, key2, deepCopy(value));
		}
		return result;
	}
	return logger$a.throwArgumentError(`Cannot deepCopy ${typeof object}`, 'object', object);
}
function deepCopy(object) {
	return _deepCopy(object);
}
class Description {
	constructor(info) {
		for (const key2 in info) {
			this[key2] = deepCopy(info[key2]);
		}
	}
}
var __awaiter$6 = function (thisArg, _arguments, P, generator) {
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
const logger$9 = new Logger(version$a);
const padding = new Uint8Array(32);
padding.fill(0);
const NegativeOne = BigNumber.from(-1);
const Zero = BigNumber.from(0);
const One = BigNumber.from(1);
const MaxUint256 = BigNumber.from('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
function hexPadRight(value) {
	const bytes = arrayify(value);
	const padOffset = bytes.length % 32;
	if (padOffset) {
		return hexConcat([bytes, padding.slice(padOffset)]);
	}
	return hexlify(bytes);
}
const hexTrue = hexZeroPad(One.toHexString(), 32);
const hexFalse = hexZeroPad(Zero.toHexString(), 32);
const domainFieldTypes = {
	name: 'string',
	version: 'string',
	chainId: 'uint256',
	verifyingContract: 'address',
	salt: 'bytes32',
};
const domainFieldNames = ['name', 'version', 'chainId', 'verifyingContract', 'salt'];
function checkString(key2) {
	return function (value) {
		if (typeof value !== 'string') {
			logger$9.throwArgumentError(`invalid domain value for ${JSON.stringify(key2)}`, `domain.${key2}`, value);
		}
		return value;
	};
}
const domainChecks = {
	name: checkString('name'),
	version: checkString('version'),
	chainId: function (value) {
		try {
			return BigNumber.from(value).toString();
		} catch (error) {}
		return logger$9.throwArgumentError(`invalid domain value for "chainId"`, 'domain.chainId', value);
	},
	verifyingContract: function (value) {
		try {
			return getAddress(value).toLowerCase();
		} catch (error) {}
		return logger$9.throwArgumentError(`invalid domain value "verifyingContract"`, 'domain.verifyingContract', value);
	},
	salt: function (value) {
		try {
			const bytes = arrayify(value);
			if (bytes.length !== 32) {
				throw new Error('bad length');
			}
			return hexlify(bytes);
		} catch (error) {}
		return logger$9.throwArgumentError(`invalid domain value "salt"`, 'domain.salt', value);
	},
};
function getBaseEncoder(type) {
	{
		const match = type.match(/^(u?)int(\d*)$/);
		if (match) {
			const signed2 = match[1] === '';
			const width = parseInt(match[2] || '256');
			if (width % 8 !== 0 || width > 256 || (match[2] && match[2] !== String(width))) {
				logger$9.throwArgumentError('invalid numeric width', 'type', type);
			}
			const boundsUpper = MaxUint256.mask(signed2 ? width - 1 : width);
			const boundsLower = signed2 ? boundsUpper.add(One).mul(NegativeOne) : Zero;
			return function (value) {
				const v = BigNumber.from(value);
				if (v.lt(boundsLower) || v.gt(boundsUpper)) {
					logger$9.throwArgumentError(`value out-of-bounds for ${type}`, 'value', value);
				}
				return hexZeroPad(v.toTwos(256).toHexString(), 32);
			};
		}
	}
	{
		const match = type.match(/^bytes(\d+)$/);
		if (match) {
			const width = parseInt(match[1]);
			if (width === 0 || width > 32 || match[1] !== String(width)) {
				logger$9.throwArgumentError('invalid bytes width', 'type', type);
			}
			return function (value) {
				const bytes = arrayify(value);
				if (bytes.length !== width) {
					logger$9.throwArgumentError(`invalid length for ${type}`, 'value', value);
				}
				return hexPadRight(value);
			};
		}
	}
	switch (type) {
		case 'address':
			return function (value) {
				return hexZeroPad(getAddress(value), 32);
			};
		case 'bool':
			return function (value) {
				return !value ? hexFalse : hexTrue;
			};
		case 'bytes':
			return function (value) {
				return keccak256(value);
			};
		case 'string':
			return function (value) {
				return id(value);
			};
	}
	return null;
}
function encodeType(name, fields) {
	return `${name}(${fields.map(({ name: name2, type }) => type + ' ' + name2).join(',')})`;
}
class TypedDataEncoder {
	constructor(types) {
		defineReadOnly(this, 'types', Object.freeze(deepCopy(types)));
		defineReadOnly(this, '_encoderCache', {});
		defineReadOnly(this, '_types', {});
		const links = {};
		const parents = {};
		const subtypes = {};
		Object.keys(types).forEach((type) => {
			links[type] = {};
			parents[type] = [];
			subtypes[type] = {};
		});
		for (const name in types) {
			const uniqueNames = {};
			types[name].forEach((field) => {
				if (uniqueNames[field.name]) {
					logger$9.throwArgumentError(`duplicate variable name ${JSON.stringify(field.name)} in ${JSON.stringify(name)}`, 'types', types);
				}
				uniqueNames[field.name] = true;
				const baseType = field.type.match(/^([^\x5b]*)(\x5b|$)/)[1];
				if (baseType === name) {
					logger$9.throwArgumentError(`circular type reference to ${JSON.stringify(baseType)}`, 'types', types);
				}
				const encoder = getBaseEncoder(baseType);
				if (encoder) {
					return;
				}
				if (!parents[baseType]) {
					logger$9.throwArgumentError(`unknown type ${JSON.stringify(baseType)}`, 'types', types);
				}
				parents[baseType].push(name);
				links[name][baseType] = true;
			});
		}
		const primaryTypes = Object.keys(parents).filter((n) => parents[n].length === 0);
		if (primaryTypes.length === 0) {
			logger$9.throwArgumentError('missing primary type', 'types', types);
		} else if (primaryTypes.length > 1) {
			logger$9.throwArgumentError(
				`ambiguous primary types or unused types: ${primaryTypes.map((t) => JSON.stringify(t)).join(', ')}`,
				'types',
				types,
			);
		}
		defineReadOnly(this, 'primaryType', primaryTypes[0]);
		function checkCircular(type, found) {
			if (found[type]) {
				logger$9.throwArgumentError(`circular type reference to ${JSON.stringify(type)}`, 'types', types);
			}
			found[type] = true;
			Object.keys(links[type]).forEach((child) => {
				if (!parents[child]) {
					return;
				}
				checkCircular(child, found);
				Object.keys(found).forEach((subtype) => {
					subtypes[subtype][child] = true;
				});
			});
			delete found[type];
		}
		checkCircular(this.primaryType, {});
		for (const name in subtypes) {
			const st = Object.keys(subtypes[name]);
			st.sort();
			this._types[name] = encodeType(name, types[name]) + st.map((t) => encodeType(t, types[t])).join('');
		}
	}
	getEncoder(type) {
		let encoder = this._encoderCache[type];
		if (!encoder) {
			encoder = this._encoderCache[type] = this._getEncoder(type);
		}
		return encoder;
	}
	_getEncoder(type) {
		{
			const encoder = getBaseEncoder(type);
			if (encoder) {
				return encoder;
			}
		}
		const match = type.match(/^(.*)(\x5b(\d*)\x5d)$/);
		if (match) {
			const subtype = match[1];
			const subEncoder = this.getEncoder(subtype);
			const length = parseInt(match[3]);
			return (value) => {
				if (length >= 0 && value.length !== length) {
					logger$9.throwArgumentError('array length mismatch; expected length ${ arrayLength }', 'value', value);
				}
				let result = value.map(subEncoder);
				if (this._types[subtype]) {
					result = result.map(keccak256);
				}
				return keccak256(hexConcat(result));
			};
		}
		const fields = this.types[type];
		if (fields) {
			const encodedType = id(this._types[type]);
			return (value) => {
				const values = fields.map(({ name, type: type2 }) => {
					const result = this.getEncoder(type2)(value[name]);
					if (this._types[type2]) {
						return keccak256(result);
					}
					return result;
				});
				values.unshift(encodedType);
				return hexConcat(values);
			};
		}
		return logger$9.throwArgumentError(`unknown type: ${type}`, 'type', type);
	}
	encodeType(name) {
		const result = this._types[name];
		if (!result) {
			logger$9.throwArgumentError(`unknown type: ${JSON.stringify(name)}`, 'name', name);
		}
		return result;
	}
	encodeData(type, value) {
		return this.getEncoder(type)(value);
	}
	hashStruct(name, value) {
		return keccak256(this.encodeData(name, value));
	}
	encode(value) {
		return this.encodeData(this.primaryType, value);
	}
	hash(value) {
		return this.hashStruct(this.primaryType, value);
	}
	_visit(type, value, callback) {
		{
			const encoder = getBaseEncoder(type);
			if (encoder) {
				return callback(type, value);
			}
		}
		const match = type.match(/^(.*)(\x5b(\d*)\x5d)$/);
		if (match) {
			const subtype = match[1];
			const length = parseInt(match[3]);
			if (length >= 0 && value.length !== length) {
				logger$9.throwArgumentError('array length mismatch; expected length ${ arrayLength }', 'value', value);
			}
			return value.map((v) => this._visit(subtype, v, callback));
		}
		const fields = this.types[type];
		if (fields) {
			return fields.reduce((accum, { name, type: type2 }) => {
				accum[name] = this._visit(type2, value[name], callback);
				return accum;
			}, {});
		}
		return logger$9.throwArgumentError(`unknown type: ${type}`, 'type', type);
	}
	visit(value, callback) {
		return this._visit(this.primaryType, value, callback);
	}
	static from(types) {
		return new TypedDataEncoder(types);
	}
	static getPrimaryType(types) {
		return TypedDataEncoder.from(types).primaryType;
	}
	static hashStruct(name, types, value) {
		return TypedDataEncoder.from(types).hashStruct(name, value);
	}
	static hashDomain(domain) {
		const domainFields = [];
		for (const name in domain) {
			const type = domainFieldTypes[name];
			if (!type) {
				logger$9.throwArgumentError(`invalid typed-data domain key: ${JSON.stringify(name)}`, 'domain', domain);
			}
			domainFields.push({ name, type });
		}
		domainFields.sort((a, b) => {
			return domainFieldNames.indexOf(a.name) - domainFieldNames.indexOf(b.name);
		});
		return TypedDataEncoder.hashStruct('EIP712Domain', { EIP712Domain: domainFields }, domain);
	}
	static encode(domain, types, value) {
		return hexConcat(['0x1901', TypedDataEncoder.hashDomain(domain), TypedDataEncoder.from(types).hash(value)]);
	}
	static hash(domain, types, value) {
		return keccak256(TypedDataEncoder.encode(domain, types, value));
	}
	// Replaces all address types with ENS names with their looked up address
	static resolveNames(domain, types, value, resolveName) {
		return __awaiter$6(this, void 0, void 0, function* () {
			domain = shallowCopy(domain);
			const ensCache = {};
			if (domain.verifyingContract && !isHexString(domain.verifyingContract, 20)) {
				ensCache[domain.verifyingContract] = '0x';
			}
			const encoder = TypedDataEncoder.from(types);
			encoder.visit(value, (type, value2) => {
				if (type === 'address' && !isHexString(value2, 20)) {
					ensCache[value2] = '0x';
				}
				return value2;
			});
			for (const name in ensCache) {
				ensCache[name] = yield resolveName(name);
			}
			if (domain.verifyingContract && ensCache[domain.verifyingContract]) {
				domain.verifyingContract = ensCache[domain.verifyingContract];
			}
			value = encoder.visit(value, (type, value2) => {
				if (type === 'address' && ensCache[value2]) {
					return ensCache[value2];
				}
				return value2;
			});
			return { domain, value };
		});
	}
	static getPayload(domain, types, value) {
		TypedDataEncoder.hashDomain(domain);
		const domainValues = {};
		const domainTypes = [];
		domainFieldNames.forEach((name) => {
			const value2 = domain[name];
			if (value2 == null) {
				return;
			}
			domainValues[name] = domainChecks[name](value2);
			domainTypes.push({ name, type: domainFieldTypes[name] });
		});
		const encoder = TypedDataEncoder.from(types);
		const typesWithDomain = shallowCopy(types);
		if (typesWithDomain.EIP712Domain) {
			logger$9.throwArgumentError('types must not contain EIP712Domain type', 'types.EIP712Domain', types);
		} else {
			typesWithDomain.EIP712Domain = domainTypes;
		}
		encoder.encode(value);
		return {
			types: typesWithDomain,
			domain: domainValues,
			primaryType: encoder.primaryType,
			message: encoder.visit(value, (type, value2) => {
				if (type.match(/^bytes(\d*)/)) {
					return hexlify(arrayify(value2));
				}
				if (type.match(/^u?int/)) {
					return BigNumber.from(value2).toString();
				}
				switch (type) {
					case 'address':
						return value2.toLowerCase();
					case 'bool':
						return !!value2;
					case 'string':
						if (typeof value2 !== 'string') {
							logger$9.throwArgumentError(`invalid string`, 'value', value2);
						}
						return value2;
				}
				return logger$9.throwArgumentError('unsupported type', 'type', type);
			}),
		};
	}
}
const version$6 = 'abstract-provider/5.8.0';
var __awaiter$5 = function (thisArg, _arguments, P, generator) {
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
const logger$8 = new Logger(version$6);
class ForkEvent extends Description {
	static isForkEvent(value) {
		return !!(value && value._isForkEvent);
	}
}
class Provider {
	constructor() {
		logger$8.checkAbstract(new.target, Provider);
		defineReadOnly(this, '_isProvider', true);
	}
	getFeeData() {
		return __awaiter$5(this, void 0, void 0, function* () {
			const { block, gasPrice } = yield resolveProperties({
				block: this.getBlock('latest'),
				gasPrice: this.getGasPrice().catch((error) => {
					return null;
				}),
			});
			let lastBaseFeePerGas = null,
				maxFeePerGas = null,
				maxPriorityFeePerGas = null;
			if (block && block.baseFeePerGas) {
				lastBaseFeePerGas = block.baseFeePerGas;
				maxPriorityFeePerGas = BigNumber.from('1500000000');
				maxFeePerGas = block.baseFeePerGas.mul(2).add(maxPriorityFeePerGas);
			}
			return { lastBaseFeePerGas, maxFeePerGas, maxPriorityFeePerGas, gasPrice };
		});
	}
	// Alias for "on"
	addListener(eventName, listener) {
		return this.on(eventName, listener);
	}
	// Alias for "off"
	removeListener(eventName, listener) {
		return this.off(eventName, listener);
	}
	static isProvider(value) {
		return !!(value && value._isProvider);
	}
}
const version$5 = 'abstract-signer/5.8.0';
var __awaiter$4 = function (thisArg, _arguments, P, generator) {
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
const logger$7 = new Logger(version$5);
const allowedTransactionKeys$1 = [
	'accessList',
	'ccipReadEnabled',
	'chainId',
	'customData',
	'data',
	'from',
	'gasLimit',
	'gasPrice',
	'maxFeePerGas',
	'maxPriorityFeePerGas',
	'nonce',
	'to',
	'type',
	'value',
];
const forwardErrors = [Logger.errors.INSUFFICIENT_FUNDS, Logger.errors.NONCE_EXPIRED, Logger.errors.REPLACEMENT_UNDERPRICED];
class Signer {
	///////////////////
	// Sub-classes MUST call super
	constructor() {
		logger$7.checkAbstract(new.target, Signer);
		defineReadOnly(this, '_isSigner', true);
	}
	///////////////////
	// Sub-classes MAY override these
	getBalance(blockTag) {
		return __awaiter$4(this, void 0, void 0, function* () {
			this._checkProvider('getBalance');
			return yield this.provider.getBalance(this.getAddress(), blockTag);
		});
	}
	getTransactionCount(blockTag) {
		return __awaiter$4(this, void 0, void 0, function* () {
			this._checkProvider('getTransactionCount');
			return yield this.provider.getTransactionCount(this.getAddress(), blockTag);
		});
	}
	// Populates "from" if unspecified, and estimates the gas for the transaction
	estimateGas(transaction) {
		return __awaiter$4(this, void 0, void 0, function* () {
			this._checkProvider('estimateGas');
			const tx = yield resolveProperties(this.checkTransaction(transaction));
			return yield this.provider.estimateGas(tx);
		});
	}
	// Populates "from" if unspecified, and calls with the transaction
	call(transaction, blockTag) {
		return __awaiter$4(this, void 0, void 0, function* () {
			this._checkProvider('call');
			const tx = yield resolveProperties(this.checkTransaction(transaction));
			return yield this.provider.call(tx, blockTag);
		});
	}
	// Populates all fields in a transaction, signs it and sends it to the network
	sendTransaction(transaction) {
		return __awaiter$4(this, void 0, void 0, function* () {
			this._checkProvider('sendTransaction');
			const tx = yield this.populateTransaction(transaction);
			const signedTx = yield this.signTransaction(tx);
			return yield this.provider.sendTransaction(signedTx);
		});
	}
	getChainId() {
		return __awaiter$4(this, void 0, void 0, function* () {
			this._checkProvider('getChainId');
			const network = yield this.provider.getNetwork();
			return network.chainId;
		});
	}
	getGasPrice() {
		return __awaiter$4(this, void 0, void 0, function* () {
			this._checkProvider('getGasPrice');
			return yield this.provider.getGasPrice();
		});
	}
	getFeeData() {
		return __awaiter$4(this, void 0, void 0, function* () {
			this._checkProvider('getFeeData');
			return yield this.provider.getFeeData();
		});
	}
	resolveName(name) {
		return __awaiter$4(this, void 0, void 0, function* () {
			this._checkProvider('resolveName');
			return yield this.provider.resolveName(name);
		});
	}
	// Checks a transaction does not contain invalid keys and if
	// no "from" is provided, populates it.
	// - does NOT require a provider
	// - adds "from" is not present
	// - returns a COPY (safe to mutate the result)
	// By default called from: (overriding these prevents it)
	//   - call
	//   - estimateGas
	//   - populateTransaction (and therefor sendTransaction)
	checkTransaction(transaction) {
		for (const key2 in transaction) {
			if (allowedTransactionKeys$1.indexOf(key2) === -1) {
				logger$7.throwArgumentError('invalid transaction key: ' + key2, 'transaction', transaction);
			}
		}
		const tx = shallowCopy(transaction);
		if (tx.from == null) {
			tx.from = this.getAddress();
		} else {
			tx.from = Promise.all([Promise.resolve(tx.from), this.getAddress()]).then((result) => {
				if (result[0].toLowerCase() !== result[1].toLowerCase()) {
					logger$7.throwArgumentError('from address mismatch', 'transaction', transaction);
				}
				return result[0];
			});
		}
		return tx;
	}
	// Populates ALL keys for a transaction and checks that "from" matches
	// this Signer. Should be used by sendTransaction but NOT by signTransaction.
	// By default called from: (overriding these prevents it)
	//   - sendTransaction
	//
	// Notes:
	//  - We allow gasPrice for EIP-1559 as long as it matches maxFeePerGas
	populateTransaction(transaction) {
		return __awaiter$4(this, void 0, void 0, function* () {
			const tx = yield resolveProperties(this.checkTransaction(transaction));
			if (tx.to != null) {
				tx.to = Promise.resolve(tx.to).then((to) =>
					__awaiter$4(this, void 0, void 0, function* () {
						if (to == null) {
							return null;
						}
						const address = yield this.resolveName(to);
						if (address == null) {
							logger$7.throwArgumentError('provided ENS name resolves to null', 'tx.to', to);
						}
						return address;
					}),
				);
				tx.to.catch((error) => {});
			}
			const hasEip1559 = tx.maxFeePerGas != null || tx.maxPriorityFeePerGas != null;
			if (tx.gasPrice != null && (tx.type === 2 || hasEip1559)) {
				logger$7.throwArgumentError('eip-1559 transaction do not support gasPrice', 'transaction', transaction);
			} else if ((tx.type === 0 || tx.type === 1) && hasEip1559) {
				logger$7.throwArgumentError(
					'pre-eip-1559 transaction do not support maxFeePerGas/maxPriorityFeePerGas',
					'transaction',
					transaction,
				);
			}
			if ((tx.type === 2 || tx.type == null) && tx.maxFeePerGas != null && tx.maxPriorityFeePerGas != null) {
				tx.type = 2;
			} else if (tx.type === 0 || tx.type === 1) {
				if (tx.gasPrice == null) {
					tx.gasPrice = this.getGasPrice();
				}
			} else {
				const feeData = yield this.getFeeData();
				if (tx.type == null) {
					if (feeData.maxFeePerGas != null && feeData.maxPriorityFeePerGas != null) {
						tx.type = 2;
						if (tx.gasPrice != null) {
							const gasPrice = tx.gasPrice;
							delete tx.gasPrice;
							tx.maxFeePerGas = gasPrice;
							tx.maxPriorityFeePerGas = gasPrice;
						} else {
							if (tx.maxFeePerGas == null) {
								tx.maxFeePerGas = feeData.maxFeePerGas;
							}
							if (tx.maxPriorityFeePerGas == null) {
								tx.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;
							}
						}
					} else if (feeData.gasPrice != null) {
						if (hasEip1559) {
							logger$7.throwError('network does not support EIP-1559', Logger.errors.UNSUPPORTED_OPERATION, {
								operation: 'populateTransaction',
							});
						}
						if (tx.gasPrice == null) {
							tx.gasPrice = feeData.gasPrice;
						}
						tx.type = 0;
					} else {
						logger$7.throwError('failed to get consistent fee data', Logger.errors.UNSUPPORTED_OPERATION, {
							operation: 'signer.getFeeData',
						});
					}
				} else if (tx.type === 2) {
					if (tx.maxFeePerGas == null) {
						tx.maxFeePerGas = feeData.maxFeePerGas;
					}
					if (tx.maxPriorityFeePerGas == null) {
						tx.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;
					}
				}
			}
			if (tx.nonce == null) {
				tx.nonce = this.getTransactionCount('pending');
			}
			if (tx.gasLimit == null) {
				tx.gasLimit = this.estimateGas(tx).catch((error) => {
					if (forwardErrors.indexOf(error.code) >= 0) {
						throw error;
					}
					return logger$7.throwError(
						'cannot estimate gas; transaction may fail or may require manual gas limit',
						Logger.errors.UNPREDICTABLE_GAS_LIMIT,
						{
							error,
							tx,
						},
					);
				});
			}
			if (tx.chainId == null) {
				tx.chainId = this.getChainId();
			} else {
				tx.chainId = Promise.all([Promise.resolve(tx.chainId), this.getChainId()]).then((results) => {
					if (results[1] !== 0 && results[0] !== results[1]) {
						logger$7.throwArgumentError('chainId address mismatch', 'transaction', transaction);
					}
					return results[0];
				});
			}
			return yield resolveProperties(tx);
		});
	}
	///////////////////
	// Sub-classes SHOULD leave these alone
	_checkProvider(operation) {
		if (!this.provider) {
			logger$7.throwError('missing provider', Logger.errors.UNSUPPORTED_OPERATION, {
				operation: operation || '_checkProvider',
			});
		}
	}
	static isSigner(value) {
		return !!(value && value._isSigner);
	}
}
class BaseX {
	constructor(alphabet) {
		defineReadOnly(this, 'alphabet', alphabet);
		defineReadOnly(this, 'base', alphabet.length);
		defineReadOnly(this, '_alphabetMap', {});
		defineReadOnly(this, '_leader', alphabet.charAt(0));
		for (let i = 0; i < alphabet.length; i++) {
			this._alphabetMap[alphabet.charAt(i)] = i;
		}
	}
	encode(value) {
		let source = arrayify(value);
		if (source.length === 0) {
			return '';
		}
		let digits = [0];
		for (let i = 0; i < source.length; ++i) {
			let carry = source[i];
			for (let j = 0; j < digits.length; ++j) {
				carry += digits[j] << 8;
				digits[j] = carry % this.base;
				carry = (carry / this.base) | 0;
			}
			while (carry > 0) {
				digits.push(carry % this.base);
				carry = (carry / this.base) | 0;
			}
		}
		let string = '';
		for (let k = 0; source[k] === 0 && k < source.length - 1; ++k) {
			string += this._leader;
		}
		for (let q = digits.length - 1; q >= 0; --q) {
			string += this.alphabet[digits[q]];
		}
		return string;
	}
	decode(value) {
		if (typeof value !== 'string') {
			throw new TypeError('Expected String');
		}
		let bytes = [];
		if (value.length === 0) {
			return new Uint8Array(bytes);
		}
		bytes.push(0);
		for (let i = 0; i < value.length; i++) {
			let byte = this._alphabetMap[value[i]];
			if (byte === void 0) {
				throw new Error('Non-base' + this.base + ' character');
			}
			let carry = byte;
			for (let j = 0; j < bytes.length; ++j) {
				carry += bytes[j] * this.base;
				bytes[j] = carry & 255;
				carry >>= 8;
			}
			while (carry > 0) {
				bytes.push(carry & 255);
				carry >>= 8;
			}
		}
		for (let k = 0; value[k] === this._leader && k < value.length - 1; ++k) {
			bytes.push(0);
		}
		return arrayify(new Uint8Array(bytes.reverse()));
	}
}
new BaseX('abcdefghijklmnopqrstuvwxyz234567');
const Base58 = new BaseX('123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz');
var hash$1 = {};
var utils = {};
var minimalisticAssert$1;
var hasRequiredMinimalisticAssert;
function requireMinimalisticAssert() {
	if (hasRequiredMinimalisticAssert) return minimalisticAssert$1;
	hasRequiredMinimalisticAssert = 1;
	minimalisticAssert$1 = assert2;
	function assert2(val, msg) {
		if (!val) throw new Error(msg || 'Assertion failed');
	}
	assert2.equal = function assertEqual2(l, r2, msg) {
		if (l != r2) throw new Error(msg || 'Assertion failed: ' + l + ' != ' + r2);
	};
	return minimalisticAssert$1;
}
var inherits = { exports: {} };
var inherits_browser$1 = { exports: {} };
var hasRequiredInherits_browser;
function requireInherits_browser() {
	if (hasRequiredInherits_browser) return inherits_browser$1.exports;
	hasRequiredInherits_browser = 1;
	if (typeof Object.create === 'function') {
		inherits_browser$1.exports = function inherits2(ctor, superCtor) {
			if (superCtor) {
				ctor.super_ = superCtor;
				ctor.prototype = Object.create(superCtor.prototype, {
					constructor: {
						value: ctor,
						enumerable: false,
						writable: true,
						configurable: true,
					},
				});
			}
		};
	} else {
		inherits_browser$1.exports = function inherits2(ctor, superCtor) {
			if (superCtor) {
				ctor.super_ = superCtor;
				var TempCtor = function () {};
				TempCtor.prototype = superCtor.prototype;
				ctor.prototype = new TempCtor();
				ctor.prototype.constructor = ctor;
			}
		};
	}
	return inherits_browser$1.exports;
}
var hasRequiredInherits;
function requireInherits() {
	if (hasRequiredInherits) return inherits.exports;
	hasRequiredInherits = 1;
	try {
		var util = require$$0;
		if (typeof util.inherits !== 'function') throw '';
		inherits.exports = util.inherits;
	} catch (e) {
		inherits.exports = requireInherits_browser();
	}
	return inherits.exports;
}
var hasRequiredUtils;
function requireUtils() {
	if (hasRequiredUtils) return utils;
	hasRequiredUtils = 1;
	var assert2 = requireMinimalisticAssert();
	var inherits2 = requireInherits();
	utils.inherits = inherits2;
	function isSurrogatePair(msg, i) {
		if ((msg.charCodeAt(i) & 64512) !== 55296) {
			return false;
		}
		if (i < 0 || i + 1 >= msg.length) {
			return false;
		}
		return (msg.charCodeAt(i + 1) & 64512) === 56320;
	}
	function toArray(msg, enc) {
		if (Array.isArray(msg)) return msg.slice();
		if (!msg) return [];
		var res = [];
		if (typeof msg === 'string') {
			if (!enc) {
				var p = 0;
				for (var i = 0; i < msg.length; i++) {
					var c = msg.charCodeAt(i);
					if (c < 128) {
						res[p++] = c;
					} else if (c < 2048) {
						res[p++] = (c >> 6) | 192;
						res[p++] = (c & 63) | 128;
					} else if (isSurrogatePair(msg, i)) {
						c = 65536 + ((c & 1023) << 10) + (msg.charCodeAt(++i) & 1023);
						res[p++] = (c >> 18) | 240;
						res[p++] = ((c >> 12) & 63) | 128;
						res[p++] = ((c >> 6) & 63) | 128;
						res[p++] = (c & 63) | 128;
					} else {
						res[p++] = (c >> 12) | 224;
						res[p++] = ((c >> 6) & 63) | 128;
						res[p++] = (c & 63) | 128;
					}
				}
			} else if (enc === 'hex') {
				msg = msg.replace(/[^a-z0-9]+/gi, '');
				if (msg.length % 2 !== 0) msg = '0' + msg;
				for (i = 0; i < msg.length; i += 2) res.push(parseInt(msg[i] + msg[i + 1], 16));
			}
		} else {
			for (i = 0; i < msg.length; i++) res[i] = msg[i] | 0;
		}
		return res;
	}
	utils.toArray = toArray;
	function toHex(msg) {
		var res = '';
		for (var i = 0; i < msg.length; i++) res += zero2(msg[i].toString(16));
		return res;
	}
	utils.toHex = toHex;
	function htonl(w) {
		var res = (w >>> 24) | ((w >>> 8) & 65280) | ((w << 8) & 16711680) | ((w & 255) << 24);
		return res >>> 0;
	}
	utils.htonl = htonl;
	function toHex32(msg, endian) {
		var res = '';
		for (var i = 0; i < msg.length; i++) {
			var w = msg[i];
			if (endian === 'little') w = htonl(w);
			res += zero8(w.toString(16));
		}
		return res;
	}
	utils.toHex32 = toHex32;
	function zero2(word) {
		if (word.length === 1) return '0' + word;
		else return word;
	}
	utils.zero2 = zero2;
	function zero8(word) {
		if (word.length === 7) return '0' + word;
		else if (word.length === 6) return '00' + word;
		else if (word.length === 5) return '000' + word;
		else if (word.length === 4) return '0000' + word;
		else if (word.length === 3) return '00000' + word;
		else if (word.length === 2) return '000000' + word;
		else if (word.length === 1) return '0000000' + word;
		else return word;
	}
	utils.zero8 = zero8;
	function join32(msg, start, end, endian) {
		var len = end - start;
		assert2(len % 4 === 0);
		var res = new Array(len / 4);
		for (var i = 0, k = start; i < res.length; i++, k += 4) {
			var w;
			if (endian === 'big') w = (msg[k] << 24) | (msg[k + 1] << 16) | (msg[k + 2] << 8) | msg[k + 3];
			else w = (msg[k + 3] << 24) | (msg[k + 2] << 16) | (msg[k + 1] << 8) | msg[k];
			res[i] = w >>> 0;
		}
		return res;
	}
	utils.join32 = join32;
	function split32(msg, endian) {
		var res = new Array(msg.length * 4);
		for (var i = 0, k = 0; i < msg.length; i++, k += 4) {
			var m = msg[i];
			if (endian === 'big') {
				res[k] = m >>> 24;
				res[k + 1] = (m >>> 16) & 255;
				res[k + 2] = (m >>> 8) & 255;
				res[k + 3] = m & 255;
			} else {
				res[k + 3] = m >>> 24;
				res[k + 2] = (m >>> 16) & 255;
				res[k + 1] = (m >>> 8) & 255;
				res[k] = m & 255;
			}
		}
		return res;
	}
	utils.split32 = split32;
	function rotr32(w, b) {
		return (w >>> b) | (w << (32 - b));
	}
	utils.rotr32 = rotr32;
	function rotl32(w, b) {
		return (w << b) | (w >>> (32 - b));
	}
	utils.rotl32 = rotl32;
	function sum32(a, b) {
		return (a + b) >>> 0;
	}
	utils.sum32 = sum32;
	function sum32_3(a, b, c) {
		return (a + b + c) >>> 0;
	}
	utils.sum32_3 = sum32_3;
	function sum32_4(a, b, c, d) {
		return (a + b + c + d) >>> 0;
	}
	utils.sum32_4 = sum32_4;
	function sum32_5(a, b, c, d, e) {
		return (a + b + c + d + e) >>> 0;
	}
	utils.sum32_5 = sum32_5;
	function sum64(buf, pos, ah, al) {
		var bh = buf[pos];
		var bl = buf[pos + 1];
		var lo = (al + bl) >>> 0;
		var hi = (lo < al ? 1 : 0) + ah + bh;
		buf[pos] = hi >>> 0;
		buf[pos + 1] = lo;
	}
	utils.sum64 = sum64;
	function sum64_hi(ah, al, bh, bl) {
		var lo = (al + bl) >>> 0;
		var hi = (lo < al ? 1 : 0) + ah + bh;
		return hi >>> 0;
	}
	utils.sum64_hi = sum64_hi;
	function sum64_lo(ah, al, bh, bl) {
		var lo = al + bl;
		return lo >>> 0;
	}
	utils.sum64_lo = sum64_lo;
	function sum64_4_hi(ah, al, bh, bl, ch, cl, dh, dl) {
		var carry = 0;
		var lo = al;
		lo = (lo + bl) >>> 0;
		carry += lo < al ? 1 : 0;
		lo = (lo + cl) >>> 0;
		carry += lo < cl ? 1 : 0;
		lo = (lo + dl) >>> 0;
		carry += lo < dl ? 1 : 0;
		var hi = ah + bh + ch + dh + carry;
		return hi >>> 0;
	}
	utils.sum64_4_hi = sum64_4_hi;
	function sum64_4_lo(ah, al, bh, bl, ch, cl, dh, dl) {
		var lo = al + bl + cl + dl;
		return lo >>> 0;
	}
	utils.sum64_4_lo = sum64_4_lo;
	function sum64_5_hi(ah, al, bh, bl, ch, cl, dh, dl, eh, el) {
		var carry = 0;
		var lo = al;
		lo = (lo + bl) >>> 0;
		carry += lo < al ? 1 : 0;
		lo = (lo + cl) >>> 0;
		carry += lo < cl ? 1 : 0;
		lo = (lo + dl) >>> 0;
		carry += lo < dl ? 1 : 0;
		lo = (lo + el) >>> 0;
		carry += lo < el ? 1 : 0;
		var hi = ah + bh + ch + dh + eh + carry;
		return hi >>> 0;
	}
	utils.sum64_5_hi = sum64_5_hi;
	function sum64_5_lo(ah, al, bh, bl, ch, cl, dh, dl, eh, el) {
		var lo = al + bl + cl + dl + el;
		return lo >>> 0;
	}
	utils.sum64_5_lo = sum64_5_lo;
	function rotr64_hi(ah, al, num) {
		var r2 = (al << (32 - num)) | (ah >>> num);
		return r2 >>> 0;
	}
	utils.rotr64_hi = rotr64_hi;
	function rotr64_lo(ah, al, num) {
		var r2 = (ah << (32 - num)) | (al >>> num);
		return r2 >>> 0;
	}
	utils.rotr64_lo = rotr64_lo;
	function shr64_hi(ah, al, num) {
		return ah >>> num;
	}
	utils.shr64_hi = shr64_hi;
	function shr64_lo(ah, al, num) {
		var r2 = (ah << (32 - num)) | (al >>> num);
		return r2 >>> 0;
	}
	utils.shr64_lo = shr64_lo;
	return utils;
}
var common$1 = {};
var hasRequiredCommon$1;
function requireCommon$1() {
	if (hasRequiredCommon$1) return common$1;
	hasRequiredCommon$1 = 1;
	var utils2 = requireUtils();
	var assert2 = requireMinimalisticAssert();
	function BlockHash() {
		this.pending = null;
		this.pendingTotal = 0;
		this.blockSize = this.constructor.blockSize;
		this.outSize = this.constructor.outSize;
		this.hmacStrength = this.constructor.hmacStrength;
		this.padLength = this.constructor.padLength / 8;
		this.endian = 'big';
		this._delta8 = this.blockSize / 8;
		this._delta32 = this.blockSize / 32;
	}
	common$1.BlockHash = BlockHash;
	BlockHash.prototype.update = function update2(msg, enc) {
		msg = utils2.toArray(msg, enc);
		if (!this.pending) this.pending = msg;
		else this.pending = this.pending.concat(msg);
		this.pendingTotal += msg.length;
		if (this.pending.length >= this._delta8) {
			msg = this.pending;
			var r2 = msg.length % this._delta8;
			this.pending = msg.slice(msg.length - r2, msg.length);
			if (this.pending.length === 0) this.pending = null;
			msg = utils2.join32(msg, 0, msg.length - r2, this.endian);
			for (var i = 0; i < msg.length; i += this._delta32) this._update(msg, i, i + this._delta32);
		}
		return this;
	};
	BlockHash.prototype.digest = function digest(enc) {
		this.update(this._pad());
		assert2(this.pending === null);
		return this._digest(enc);
	};
	BlockHash.prototype._pad = function pad() {
		var len = this.pendingTotal;
		var bytes = this._delta8;
		var k = bytes - ((len + this.padLength) % bytes);
		var res = new Array(k + this.padLength);
		res[0] = 128;
		for (var i = 1; i < k; i++) res[i] = 0;
		len <<= 3;
		if (this.endian === 'big') {
			for (var t = 8; t < this.padLength; t++) res[i++] = 0;
			res[i++] = 0;
			res[i++] = 0;
			res[i++] = 0;
			res[i++] = 0;
			res[i++] = (len >>> 24) & 255;
			res[i++] = (len >>> 16) & 255;
			res[i++] = (len >>> 8) & 255;
			res[i++] = len & 255;
		} else {
			res[i++] = len & 255;
			res[i++] = (len >>> 8) & 255;
			res[i++] = (len >>> 16) & 255;
			res[i++] = (len >>> 24) & 255;
			res[i++] = 0;
			res[i++] = 0;
			res[i++] = 0;
			res[i++] = 0;
			for (t = 8; t < this.padLength; t++) res[i++] = 0;
		}
		return res;
	};
	return common$1;
}
var sha = {};
var common = {};
var hasRequiredCommon;
function requireCommon() {
	if (hasRequiredCommon) return common;
	hasRequiredCommon = 1;
	var utils2 = requireUtils();
	var rotr32 = utils2.rotr32;
	function ft_1(s, x, y, z) {
		if (s === 0) return ch32(x, y, z);
		if (s === 1 || s === 3) return p32(x, y, z);
		if (s === 2) return maj32(x, y, z);
	}
	common.ft_1 = ft_1;
	function ch32(x, y, z) {
		return (x & y) ^ (~x & z);
	}
	common.ch32 = ch32;
	function maj32(x, y, z) {
		return (x & y) ^ (x & z) ^ (y & z);
	}
	common.maj32 = maj32;
	function p32(x, y, z) {
		return x ^ y ^ z;
	}
	common.p32 = p32;
	function s0_256(x) {
		return rotr32(x, 2) ^ rotr32(x, 13) ^ rotr32(x, 22);
	}
	common.s0_256 = s0_256;
	function s1_256(x) {
		return rotr32(x, 6) ^ rotr32(x, 11) ^ rotr32(x, 25);
	}
	common.s1_256 = s1_256;
	function g0_256(x) {
		return rotr32(x, 7) ^ rotr32(x, 18) ^ (x >>> 3);
	}
	common.g0_256 = g0_256;
	function g1_256(x) {
		return rotr32(x, 17) ^ rotr32(x, 19) ^ (x >>> 10);
	}
	common.g1_256 = g1_256;
	return common;
}
var _1;
var hasRequired_1;
function require_1() {
	if (hasRequired_1) return _1;
	hasRequired_1 = 1;
	var utils2 = requireUtils();
	var common2 = requireCommon$1();
	var shaCommon = requireCommon();
	var rotl32 = utils2.rotl32;
	var sum32 = utils2.sum32;
	var sum32_5 = utils2.sum32_5;
	var ft_1 = shaCommon.ft_1;
	var BlockHash = common2.BlockHash;
	var sha1_K = [1518500249, 1859775393, 2400959708, 3395469782];
	function SHA1() {
		if (!(this instanceof SHA1)) return new SHA1();
		BlockHash.call(this);
		this.h = [1732584193, 4023233417, 2562383102, 271733878, 3285377520];
		this.W = new Array(80);
	}
	utils2.inherits(SHA1, BlockHash);
	_1 = SHA1;
	SHA1.blockSize = 512;
	SHA1.outSize = 160;
	SHA1.hmacStrength = 80;
	SHA1.padLength = 64;
	SHA1.prototype._update = function _update(msg, start) {
		var W = this.W;
		for (var i = 0; i < 16; i++) W[i] = msg[start + i];
		for (; i < W.length; i++) W[i] = rotl32(W[i - 3] ^ W[i - 8] ^ W[i - 14] ^ W[i - 16], 1);
		var a = this.h[0];
		var b = this.h[1];
		var c = this.h[2];
		var d = this.h[3];
		var e = this.h[4];
		for (i = 0; i < W.length; i++) {
			var s = ~~(i / 20);
			var t = sum32_5(rotl32(a, 5), ft_1(s, b, c, d), e, W[i], sha1_K[s]);
			e = d;
			d = c;
			c = rotl32(b, 30);
			b = a;
			a = t;
		}
		this.h[0] = sum32(this.h[0], a);
		this.h[1] = sum32(this.h[1], b);
		this.h[2] = sum32(this.h[2], c);
		this.h[3] = sum32(this.h[3], d);
		this.h[4] = sum32(this.h[4], e);
	};
	SHA1.prototype._digest = function digest(enc) {
		if (enc === 'hex') return utils2.toHex32(this.h, 'big');
		else return utils2.split32(this.h, 'big');
	};
	return _1;
}
var _256;
var hasRequired_256;
function require_256() {
	if (hasRequired_256) return _256;
	hasRequired_256 = 1;
	var utils2 = requireUtils();
	var common2 = requireCommon$1();
	var shaCommon = requireCommon();
	var assert2 = requireMinimalisticAssert();
	var sum32 = utils2.sum32;
	var sum32_4 = utils2.sum32_4;
	var sum32_5 = utils2.sum32_5;
	var ch32 = shaCommon.ch32;
	var maj32 = shaCommon.maj32;
	var s0_256 = shaCommon.s0_256;
	var s1_256 = shaCommon.s1_256;
	var g0_256 = shaCommon.g0_256;
	var g1_256 = shaCommon.g1_256;
	var BlockHash = common2.BlockHash;
	var sha256_K = [
		1116352408, 1899447441, 3049323471, 3921009573, 961987163, 1508970993, 2453635748, 2870763221, 3624381080, 310598401, 607225278,
		1426881987, 1925078388, 2162078206, 2614888103, 3248222580, 3835390401, 4022224774, 264347078, 604807628, 770255983, 1249150122,
		1555081692, 1996064986, 2554220882, 2821834349, 2952996808, 3210313671, 3336571891, 3584528711, 113926993, 338241895, 666307205,
		773529912, 1294757372, 1396182291, 1695183700, 1986661051, 2177026350, 2456956037, 2730485921, 2820302411, 3259730800, 3345764771,
		3516065817, 3600352804, 4094571909, 275423344, 430227734, 506948616, 659060556, 883997877, 958139571, 1322822218, 1537002063,
		1747873779, 1955562222, 2024104815, 2227730452, 2361852424, 2428436474, 2756734187, 3204031479, 3329325298,
	];
	function SHA256() {
		if (!(this instanceof SHA256)) return new SHA256();
		BlockHash.call(this);
		this.h = [1779033703, 3144134277, 1013904242, 2773480762, 1359893119, 2600822924, 528734635, 1541459225];
		this.k = sha256_K;
		this.W = new Array(64);
	}
	utils2.inherits(SHA256, BlockHash);
	_256 = SHA256;
	SHA256.blockSize = 512;
	SHA256.outSize = 256;
	SHA256.hmacStrength = 192;
	SHA256.padLength = 64;
	SHA256.prototype._update = function _update(msg, start) {
		var W = this.W;
		for (var i = 0; i < 16; i++) W[i] = msg[start + i];
		for (; i < W.length; i++) W[i] = sum32_4(g1_256(W[i - 2]), W[i - 7], g0_256(W[i - 15]), W[i - 16]);
		var a = this.h[0];
		var b = this.h[1];
		var c = this.h[2];
		var d = this.h[3];
		var e = this.h[4];
		var f = this.h[5];
		var g = this.h[6];
		var h = this.h[7];
		assert2(this.k.length === W.length);
		for (i = 0; i < W.length; i++) {
			var T1 = sum32_5(h, s1_256(e), ch32(e, f, g), this.k[i], W[i]);
			var T2 = sum32(s0_256(a), maj32(a, b, c));
			h = g;
			g = f;
			f = e;
			e = sum32(d, T1);
			d = c;
			c = b;
			b = a;
			a = sum32(T1, T2);
		}
		this.h[0] = sum32(this.h[0], a);
		this.h[1] = sum32(this.h[1], b);
		this.h[2] = sum32(this.h[2], c);
		this.h[3] = sum32(this.h[3], d);
		this.h[4] = sum32(this.h[4], e);
		this.h[5] = sum32(this.h[5], f);
		this.h[6] = sum32(this.h[6], g);
		this.h[7] = sum32(this.h[7], h);
	};
	SHA256.prototype._digest = function digest(enc) {
		if (enc === 'hex') return utils2.toHex32(this.h, 'big');
		else return utils2.split32(this.h, 'big');
	};
	return _256;
}
var _224;
var hasRequired_224;
function require_224() {
	if (hasRequired_224) return _224;
	hasRequired_224 = 1;
	var utils2 = requireUtils();
	var SHA256 = require_256();
	function SHA224() {
		if (!(this instanceof SHA224)) return new SHA224();
		SHA256.call(this);
		this.h = [3238371032, 914150663, 812702999, 4144912697, 4290775857, 1750603025, 1694076839, 3204075428];
	}
	utils2.inherits(SHA224, SHA256);
	_224 = SHA224;
	SHA224.blockSize = 512;
	SHA224.outSize = 224;
	SHA224.hmacStrength = 192;
	SHA224.padLength = 64;
	SHA224.prototype._digest = function digest(enc) {
		if (enc === 'hex') return utils2.toHex32(this.h.slice(0, 7), 'big');
		else return utils2.split32(this.h.slice(0, 7), 'big');
	};
	return _224;
}
var _512;
var hasRequired_512;
function require_512() {
	if (hasRequired_512) return _512;
	hasRequired_512 = 1;
	var utils2 = requireUtils();
	var common2 = requireCommon$1();
	var assert2 = requireMinimalisticAssert();
	var rotr64_hi = utils2.rotr64_hi;
	var rotr64_lo = utils2.rotr64_lo;
	var shr64_hi = utils2.shr64_hi;
	var shr64_lo = utils2.shr64_lo;
	var sum64 = utils2.sum64;
	var sum64_hi = utils2.sum64_hi;
	var sum64_lo = utils2.sum64_lo;
	var sum64_4_hi = utils2.sum64_4_hi;
	var sum64_4_lo = utils2.sum64_4_lo;
	var sum64_5_hi = utils2.sum64_5_hi;
	var sum64_5_lo = utils2.sum64_5_lo;
	var BlockHash = common2.BlockHash;
	var sha512_K = [
		1116352408, 3609767458, 1899447441, 602891725, 3049323471, 3964484399, 3921009573, 2173295548, 961987163, 4081628472, 1508970993,
		3053834265, 2453635748, 2937671579, 2870763221, 3664609560, 3624381080, 2734883394, 310598401, 1164996542, 607225278, 1323610764,
		1426881987, 3590304994, 1925078388, 4068182383, 2162078206, 991336113, 2614888103, 633803317, 3248222580, 3479774868, 3835390401,
		2666613458, 4022224774, 944711139, 264347078, 2341262773, 604807628, 2007800933, 770255983, 1495990901, 1249150122, 1856431235,
		1555081692, 3175218132, 1996064986, 2198950837, 2554220882, 3999719339, 2821834349, 766784016, 2952996808, 2566594879, 3210313671,
		3203337956, 3336571891, 1034457026, 3584528711, 2466948901, 113926993, 3758326383, 338241895, 168717936, 666307205, 1188179964,
		773529912, 1546045734, 1294757372, 1522805485, 1396182291, 2643833823, 1695183700, 2343527390, 1986661051, 1014477480, 2177026350,
		1206759142, 2456956037, 344077627, 2730485921, 1290863460, 2820302411, 3158454273, 3259730800, 3505952657, 3345764771, 106217008,
		3516065817, 3606008344, 3600352804, 1432725776, 4094571909, 1467031594, 275423344, 851169720, 430227734, 3100823752, 506948616,
		1363258195, 659060556, 3750685593, 883997877, 3785050280, 958139571, 3318307427, 1322822218, 3812723403, 1537002063, 2003034995,
		1747873779, 3602036899, 1955562222, 1575990012, 2024104815, 1125592928, 2227730452, 2716904306, 2361852424, 442776044, 2428436474,
		593698344, 2756734187, 3733110249, 3204031479, 2999351573, 3329325298, 3815920427, 3391569614, 3928383900, 3515267271, 566280711,
		3940187606, 3454069534, 4118630271, 4000239992, 116418474, 1914138554, 174292421, 2731055270, 289380356, 3203993006, 460393269,
		320620315, 685471733, 587496836, 852142971, 1086792851, 1017036298, 365543100, 1126000580, 2618297676, 1288033470, 3409855158,
		1501505948, 4234509866, 1607167915, 987167468, 1816402316, 1246189591,
	];
	function SHA512() {
		if (!(this instanceof SHA512)) return new SHA512();
		BlockHash.call(this);
		this.h = [
			1779033703, 4089235720, 3144134277, 2227873595, 1013904242, 4271175723, 2773480762, 1595750129, 1359893119, 2917565137, 2600822924,
			725511199, 528734635, 4215389547, 1541459225, 327033209,
		];
		this.k = sha512_K;
		this.W = new Array(160);
	}
	utils2.inherits(SHA512, BlockHash);
	_512 = SHA512;
	SHA512.blockSize = 1024;
	SHA512.outSize = 512;
	SHA512.hmacStrength = 192;
	SHA512.padLength = 128;
	SHA512.prototype._prepareBlock = function _prepareBlock(msg, start) {
		var W = this.W;
		for (var i = 0; i < 32; i++) W[i] = msg[start + i];
		for (; i < W.length; i += 2) {
			var c0_hi = g1_512_hi(W[i - 4], W[i - 3]);
			var c0_lo = g1_512_lo(W[i - 4], W[i - 3]);
			var c1_hi = W[i - 14];
			var c1_lo = W[i - 13];
			var c2_hi = g0_512_hi(W[i - 30], W[i - 29]);
			var c2_lo = g0_512_lo(W[i - 30], W[i - 29]);
			var c3_hi = W[i - 32];
			var c3_lo = W[i - 31];
			W[i] = sum64_4_hi(c0_hi, c0_lo, c1_hi, c1_lo, c2_hi, c2_lo, c3_hi, c3_lo);
			W[i + 1] = sum64_4_lo(c0_hi, c0_lo, c1_hi, c1_lo, c2_hi, c2_lo, c3_hi, c3_lo);
		}
	};
	SHA512.prototype._update = function _update(msg, start) {
		this._prepareBlock(msg, start);
		var W = this.W;
		var ah = this.h[0];
		var al = this.h[1];
		var bh = this.h[2];
		var bl = this.h[3];
		var ch = this.h[4];
		var cl = this.h[5];
		var dh = this.h[6];
		var dl = this.h[7];
		var eh = this.h[8];
		var el = this.h[9];
		var fh = this.h[10];
		var fl = this.h[11];
		var gh = this.h[12];
		var gl = this.h[13];
		var hh = this.h[14];
		var hl = this.h[15];
		assert2(this.k.length === W.length);
		for (var i = 0; i < W.length; i += 2) {
			var c0_hi = hh;
			var c0_lo = hl;
			var c1_hi = s1_512_hi(eh, el);
			var c1_lo = s1_512_lo(eh, el);
			var c2_hi = ch64_hi(eh, el, fh, fl, gh);
			var c2_lo = ch64_lo(eh, el, fh, fl, gh, gl);
			var c3_hi = this.k[i];
			var c3_lo = this.k[i + 1];
			var c4_hi = W[i];
			var c4_lo = W[i + 1];
			var T1_hi = sum64_5_hi(c0_hi, c0_lo, c1_hi, c1_lo, c2_hi, c2_lo, c3_hi, c3_lo, c4_hi, c4_lo);
			var T1_lo = sum64_5_lo(c0_hi, c0_lo, c1_hi, c1_lo, c2_hi, c2_lo, c3_hi, c3_lo, c4_hi, c4_lo);
			c0_hi = s0_512_hi(ah, al);
			c0_lo = s0_512_lo(ah, al);
			c1_hi = maj64_hi(ah, al, bh, bl, ch);
			c1_lo = maj64_lo(ah, al, bh, bl, ch, cl);
			var T2_hi = sum64_hi(c0_hi, c0_lo, c1_hi, c1_lo);
			var T2_lo = sum64_lo(c0_hi, c0_lo, c1_hi, c1_lo);
			hh = gh;
			hl = gl;
			gh = fh;
			gl = fl;
			fh = eh;
			fl = el;
			eh = sum64_hi(dh, dl, T1_hi, T1_lo);
			el = sum64_lo(dl, dl, T1_hi, T1_lo);
			dh = ch;
			dl = cl;
			ch = bh;
			cl = bl;
			bh = ah;
			bl = al;
			ah = sum64_hi(T1_hi, T1_lo, T2_hi, T2_lo);
			al = sum64_lo(T1_hi, T1_lo, T2_hi, T2_lo);
		}
		sum64(this.h, 0, ah, al);
		sum64(this.h, 2, bh, bl);
		sum64(this.h, 4, ch, cl);
		sum64(this.h, 6, dh, dl);
		sum64(this.h, 8, eh, el);
		sum64(this.h, 10, fh, fl);
		sum64(this.h, 12, gh, gl);
		sum64(this.h, 14, hh, hl);
	};
	SHA512.prototype._digest = function digest(enc) {
		if (enc === 'hex') return utils2.toHex32(this.h, 'big');
		else return utils2.split32(this.h, 'big');
	};
	function ch64_hi(xh, xl, yh, yl, zh) {
		var r2 = (xh & yh) ^ (~xh & zh);
		if (r2 < 0) r2 += 4294967296;
		return r2;
	}
	function ch64_lo(xh, xl, yh, yl, zh, zl) {
		var r2 = (xl & yl) ^ (~xl & zl);
		if (r2 < 0) r2 += 4294967296;
		return r2;
	}
	function maj64_hi(xh, xl, yh, yl, zh) {
		var r2 = (xh & yh) ^ (xh & zh) ^ (yh & zh);
		if (r2 < 0) r2 += 4294967296;
		return r2;
	}
	function maj64_lo(xh, xl, yh, yl, zh, zl) {
		var r2 = (xl & yl) ^ (xl & zl) ^ (yl & zl);
		if (r2 < 0) r2 += 4294967296;
		return r2;
	}
	function s0_512_hi(xh, xl) {
		var c0_hi = rotr64_hi(xh, xl, 28);
		var c1_hi = rotr64_hi(xl, xh, 2);
		var c2_hi = rotr64_hi(xl, xh, 7);
		var r2 = c0_hi ^ c1_hi ^ c2_hi;
		if (r2 < 0) r2 += 4294967296;
		return r2;
	}
	function s0_512_lo(xh, xl) {
		var c0_lo = rotr64_lo(xh, xl, 28);
		var c1_lo = rotr64_lo(xl, xh, 2);
		var c2_lo = rotr64_lo(xl, xh, 7);
		var r2 = c0_lo ^ c1_lo ^ c2_lo;
		if (r2 < 0) r2 += 4294967296;
		return r2;
	}
	function s1_512_hi(xh, xl) {
		var c0_hi = rotr64_hi(xh, xl, 14);
		var c1_hi = rotr64_hi(xh, xl, 18);
		var c2_hi = rotr64_hi(xl, xh, 9);
		var r2 = c0_hi ^ c1_hi ^ c2_hi;
		if (r2 < 0) r2 += 4294967296;
		return r2;
	}
	function s1_512_lo(xh, xl) {
		var c0_lo = rotr64_lo(xh, xl, 14);
		var c1_lo = rotr64_lo(xh, xl, 18);
		var c2_lo = rotr64_lo(xl, xh, 9);
		var r2 = c0_lo ^ c1_lo ^ c2_lo;
		if (r2 < 0) r2 += 4294967296;
		return r2;
	}
	function g0_512_hi(xh, xl) {
		var c0_hi = rotr64_hi(xh, xl, 1);
		var c1_hi = rotr64_hi(xh, xl, 8);
		var c2_hi = shr64_hi(xh, xl, 7);
		var r2 = c0_hi ^ c1_hi ^ c2_hi;
		if (r2 < 0) r2 += 4294967296;
		return r2;
	}
	function g0_512_lo(xh, xl) {
		var c0_lo = rotr64_lo(xh, xl, 1);
		var c1_lo = rotr64_lo(xh, xl, 8);
		var c2_lo = shr64_lo(xh, xl, 7);
		var r2 = c0_lo ^ c1_lo ^ c2_lo;
		if (r2 < 0) r2 += 4294967296;
		return r2;
	}
	function g1_512_hi(xh, xl) {
		var c0_hi = rotr64_hi(xh, xl, 19);
		var c1_hi = rotr64_hi(xl, xh, 29);
		var c2_hi = shr64_hi(xh, xl, 6);
		var r2 = c0_hi ^ c1_hi ^ c2_hi;
		if (r2 < 0) r2 += 4294967296;
		return r2;
	}
	function g1_512_lo(xh, xl) {
		var c0_lo = rotr64_lo(xh, xl, 19);
		var c1_lo = rotr64_lo(xl, xh, 29);
		var c2_lo = shr64_lo(xh, xl, 6);
		var r2 = c0_lo ^ c1_lo ^ c2_lo;
		if (r2 < 0) r2 += 4294967296;
		return r2;
	}
	return _512;
}
var _384;
var hasRequired_384;
function require_384() {
	if (hasRequired_384) return _384;
	hasRequired_384 = 1;
	var utils2 = requireUtils();
	var SHA512 = require_512();
	function SHA384() {
		if (!(this instanceof SHA384)) return new SHA384();
		SHA512.call(this);
		this.h = [
			3418070365, 3238371032, 1654270250, 914150663, 2438529370, 812702999, 355462360, 4144912697, 1731405415, 4290775857, 2394180231,
			1750603025, 3675008525, 1694076839, 1203062813, 3204075428,
		];
	}
	utils2.inherits(SHA384, SHA512);
	_384 = SHA384;
	SHA384.blockSize = 1024;
	SHA384.outSize = 384;
	SHA384.hmacStrength = 192;
	SHA384.padLength = 128;
	SHA384.prototype._digest = function digest(enc) {
		if (enc === 'hex') return utils2.toHex32(this.h.slice(0, 12), 'big');
		else return utils2.split32(this.h.slice(0, 12), 'big');
	};
	return _384;
}
var hasRequiredSha;
function requireSha() {
	if (hasRequiredSha) return sha;
	hasRequiredSha = 1;
	sha.sha1 = require_1();
	sha.sha224 = require_224();
	sha.sha256 = require_256();
	sha.sha384 = require_384();
	sha.sha512 = require_512();
	return sha;
}
var ripemd = {};
var hasRequiredRipemd;
function requireRipemd() {
	if (hasRequiredRipemd) return ripemd;
	hasRequiredRipemd = 1;
	var utils2 = requireUtils();
	var common2 = requireCommon$1();
	var rotl32 = utils2.rotl32;
	var sum32 = utils2.sum32;
	var sum32_3 = utils2.sum32_3;
	var sum32_4 = utils2.sum32_4;
	var BlockHash = common2.BlockHash;
	function RIPEMD160() {
		if (!(this instanceof RIPEMD160)) return new RIPEMD160();
		BlockHash.call(this);
		this.h = [1732584193, 4023233417, 2562383102, 271733878, 3285377520];
		this.endian = 'little';
	}
	utils2.inherits(RIPEMD160, BlockHash);
	ripemd.ripemd160 = RIPEMD160;
	RIPEMD160.blockSize = 512;
	RIPEMD160.outSize = 160;
	RIPEMD160.hmacStrength = 192;
	RIPEMD160.padLength = 64;
	RIPEMD160.prototype._update = function update2(msg, start) {
		var A = this.h[0];
		var B = this.h[1];
		var C = this.h[2];
		var D = this.h[3];
		var E = this.h[4];
		var Ah = A;
		var Bh = B;
		var Ch = C;
		var Dh = D;
		var Eh = E;
		for (var j = 0; j < 80; j++) {
			var T = sum32(rotl32(sum32_4(A, f(j, B, C, D), msg[r2[j] + start], K(j)), s[j]), E);
			A = E;
			E = D;
			D = rotl32(C, 10);
			C = B;
			B = T;
			T = sum32(rotl32(sum32_4(Ah, f(79 - j, Bh, Ch, Dh), msg[rh[j] + start], Kh(j)), sh[j]), Eh);
			Ah = Eh;
			Eh = Dh;
			Dh = rotl32(Ch, 10);
			Ch = Bh;
			Bh = T;
		}
		T = sum32_3(this.h[1], C, Dh);
		this.h[1] = sum32_3(this.h[2], D, Eh);
		this.h[2] = sum32_3(this.h[3], E, Ah);
		this.h[3] = sum32_3(this.h[4], A, Bh);
		this.h[4] = sum32_3(this.h[0], B, Ch);
		this.h[0] = T;
	};
	RIPEMD160.prototype._digest = function digest(enc) {
		if (enc === 'hex') return utils2.toHex32(this.h, 'little');
		else return utils2.split32(this.h, 'little');
	};
	function f(j, x, y, z) {
		if (j <= 15) return x ^ y ^ z;
		else if (j <= 31) return (x & y) | (~x & z);
		else if (j <= 47) return (x | ~y) ^ z;
		else if (j <= 63) return (x & z) | (y & ~z);
		else return x ^ (y | ~z);
	}
	function K(j) {
		if (j <= 15) return 0;
		else if (j <= 31) return 1518500249;
		else if (j <= 47) return 1859775393;
		else if (j <= 63) return 2400959708;
		else return 2840853838;
	}
	function Kh(j) {
		if (j <= 15) return 1352829926;
		else if (j <= 31) return 1548603684;
		else if (j <= 47) return 1836072691;
		else if (j <= 63) return 2053994217;
		else return 0;
	}
	var r2 = [
		0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 7, 4, 13, 1, 10, 6, 15, 3, 12, 0, 9, 5, 2, 14, 11, 8, 3, 10, 14, 4, 9, 15, 8, 1,
		2, 7, 0, 6, 13, 11, 5, 12, 1, 9, 11, 10, 0, 8, 12, 4, 13, 3, 7, 15, 14, 5, 6, 2, 4, 0, 5, 9, 7, 12, 2, 10, 14, 1, 3, 8, 11, 6, 15, 13,
	];
	var rh = [
		5, 14, 7, 0, 9, 2, 11, 4, 13, 6, 15, 8, 1, 10, 3, 12, 6, 11, 3, 7, 0, 13, 5, 10, 14, 15, 8, 12, 4, 9, 1, 2, 15, 5, 1, 3, 7, 14, 6, 9,
		11, 8, 12, 2, 10, 0, 4, 13, 8, 6, 4, 1, 3, 11, 15, 0, 5, 12, 2, 13, 9, 7, 10, 14, 12, 15, 10, 4, 1, 5, 8, 7, 6, 2, 13, 14, 0, 3, 9, 11,
	];
	var s = [
		11, 14, 15, 12, 5, 8, 7, 9, 11, 13, 14, 15, 6, 7, 9, 8, 7, 6, 8, 13, 11, 9, 7, 15, 7, 12, 15, 9, 11, 7, 13, 12, 11, 13, 6, 7, 14, 9, 13,
		15, 14, 8, 13, 6, 5, 12, 7, 5, 11, 12, 14, 15, 14, 15, 9, 8, 9, 14, 5, 6, 8, 6, 5, 12, 9, 15, 5, 11, 6, 8, 13, 12, 5, 12, 13, 14, 11, 8,
		5, 6,
	];
	var sh = [
		8, 9, 9, 11, 13, 15, 15, 5, 7, 7, 8, 11, 14, 14, 12, 6, 9, 13, 15, 7, 12, 8, 9, 11, 7, 7, 12, 7, 6, 15, 13, 11, 9, 7, 15, 11, 8, 6, 6,
		14, 12, 13, 5, 14, 13, 13, 7, 5, 15, 5, 8, 11, 14, 14, 6, 14, 6, 9, 12, 9, 12, 5, 15, 8, 8, 5, 12, 9, 12, 5, 14, 6, 8, 13, 6, 5, 15, 13,
		11, 11,
	];
	return ripemd;
}
var hmac;
var hasRequiredHmac;
function requireHmac() {
	if (hasRequiredHmac) return hmac;
	hasRequiredHmac = 1;
	var utils2 = requireUtils();
	var assert2 = requireMinimalisticAssert();
	function Hmac(hash2, key2, enc) {
		if (!(this instanceof Hmac)) return new Hmac(hash2, key2, enc);
		this.Hash = hash2;
		this.blockSize = hash2.blockSize / 8;
		this.outSize = hash2.outSize / 8;
		this.inner = null;
		this.outer = null;
		this._init(utils2.toArray(key2, enc));
	}
	hmac = Hmac;
	Hmac.prototype._init = function init2(key2) {
		if (key2.length > this.blockSize) key2 = new this.Hash().update(key2).digest();
		assert2(key2.length <= this.blockSize);
		for (var i = key2.length; i < this.blockSize; i++) key2.push(0);
		for (i = 0; i < key2.length; i++) key2[i] ^= 54;
		this.inner = new this.Hash().update(key2);
		for (i = 0; i < key2.length; i++) key2[i] ^= 106;
		this.outer = new this.Hash().update(key2);
	};
	Hmac.prototype.update = function update2(msg, enc) {
		this.inner.update(msg, enc);
		return this;
	};
	Hmac.prototype.digest = function digest(enc) {
		this.outer.update(this.inner.digest());
		return this.outer.digest(enc);
	};
	return hmac;
}
var hasRequiredHash;
function requireHash() {
	if (hasRequiredHash) return hash$1;
	hasRequiredHash = 1;
	(function (exports) {
		var hash2 = exports;
		hash2.utils = requireUtils();
		hash2.common = requireCommon$1();
		hash2.sha = requireSha();
		hash2.ripemd = requireRipemd();
		hash2.hmac = requireHmac();
		hash2.sha1 = hash2.sha.sha1;
		hash2.sha256 = hash2.sha.sha256;
		hash2.sha224 = hash2.sha.sha224;
		hash2.sha384 = hash2.sha.sha384;
		hash2.sha512 = hash2.sha.sha512;
		hash2.ripemd160 = hash2.ripemd.ripemd160;
	})(hash$1);
	return hash$1;
}
var hashExports = requireHash();
const hash = /* @__PURE__ */ getDefaultExportFromCjs(hashExports);
function sha256(data) {
	return '0x' + hash.sha256().update(arrayify(data)).digest('hex');
}
function createCommonjsModule(fn, basedir, module) {
	return (
		(module = {
			path: basedir,
			exports: {},
			require: function (path, base2) {
				return commonjsRequire(path, base2 === void 0 || base2 === null ? module.path : base2);
			},
		}),
		fn(module, module.exports),
		module.exports
	);
}
function commonjsRequire() {
	throw new Error('Dynamic requires are not currently supported by @rollup/plugin-commonjs');
}
var minimalisticAssert = assert;
function assert(val, msg) {
	if (!val) throw new Error(msg || 'Assertion failed');
}
assert.equal = function assertEqual(l, r2, msg) {
	if (l != r2) throw new Error(msg || 'Assertion failed: ' + l + ' != ' + r2);
};
var utils_1 = createCommonjsModule(function (module, exports) {
	var utils2 = exports;
	function toArray(msg, enc) {
		if (Array.isArray(msg)) return msg.slice();
		if (!msg) return [];
		var res = [];
		if (typeof msg !== 'string') {
			for (var i = 0; i < msg.length; i++) res[i] = msg[i] | 0;
			return res;
		}
		if (enc === 'hex') {
			msg = msg.replace(/[^a-z0-9]+/gi, '');
			if (msg.length % 2 !== 0) msg = '0' + msg;
			for (var i = 0; i < msg.length; i += 2) res.push(parseInt(msg[i] + msg[i + 1], 16));
		} else {
			for (var i = 0; i < msg.length; i++) {
				var c = msg.charCodeAt(i);
				var hi = c >> 8;
				var lo = c & 255;
				if (hi) res.push(hi, lo);
				else res.push(lo);
			}
		}
		return res;
	}
	utils2.toArray = toArray;
	function zero2(word) {
		if (word.length === 1) return '0' + word;
		else return word;
	}
	utils2.zero2 = zero2;
	function toHex(msg) {
		var res = '';
		for (var i = 0; i < msg.length; i++) res += zero2(msg[i].toString(16));
		return res;
	}
	utils2.toHex = toHex;
	utils2.encode = function encode3(arr, enc) {
		if (enc === 'hex') return toHex(arr);
		else return arr;
	};
});
var utils_1$1 = createCommonjsModule(function (module, exports) {
	var utils2 = exports;
	utils2.assert = minimalisticAssert;
	utils2.toArray = utils_1.toArray;
	utils2.zero2 = utils_1.zero2;
	utils2.toHex = utils_1.toHex;
	utils2.encode = utils_1.encode;
	function getNAF2(num, w, bits) {
		var naf = new Array(Math.max(num.bitLength(), bits) + 1);
		var i;
		for (i = 0; i < naf.length; i += 1) {
			naf[i] = 0;
		}
		var ws = 1 << (w + 1);
		var k = num.clone();
		for (i = 0; i < naf.length; i++) {
			var z;
			var mod = k.andln(ws - 1);
			if (k.isOdd()) {
				if (mod > (ws >> 1) - 1) z = (ws >> 1) - mod;
				else z = mod;
				k.isubn(z);
			} else {
				z = 0;
			}
			naf[i] = z;
			k.iushrn(1);
		}
		return naf;
	}
	utils2.getNAF = getNAF2;
	function getJSF2(k1, k2) {
		var jsf = [[], []];
		k1 = k1.clone();
		k2 = k2.clone();
		var d1 = 0;
		var d2 = 0;
		var m8;
		while (k1.cmpn(-d1) > 0 || k2.cmpn(-d2) > 0) {
			var m14 = (k1.andln(3) + d1) & 3;
			var m24 = (k2.andln(3) + d2) & 3;
			if (m14 === 3) m14 = -1;
			if (m24 === 3) m24 = -1;
			var u1;
			if ((m14 & 1) === 0) {
				u1 = 0;
			} else {
				m8 = (k1.andln(7) + d1) & 7;
				if ((m8 === 3 || m8 === 5) && m24 === 2) u1 = -m14;
				else u1 = m14;
			}
			jsf[0].push(u1);
			var u2;
			if ((m24 & 1) === 0) {
				u2 = 0;
			} else {
				m8 = (k2.andln(7) + d2) & 7;
				if ((m8 === 3 || m8 === 5) && m14 === 2) u2 = -m24;
				else u2 = m24;
			}
			jsf[1].push(u2);
			if (2 * d1 === u1 + 1) d1 = 1 - d1;
			if (2 * d2 === u2 + 1) d2 = 1 - d2;
			k1.iushrn(1);
			k2.iushrn(1);
		}
		return jsf;
	}
	utils2.getJSF = getJSF2;
	function cachedProperty(obj, name, computer) {
		var key2 = '_' + name;
		obj.prototype[name] = function cachedProperty2() {
			return this[key2] !== void 0 ? this[key2] : (this[key2] = computer.call(this));
		};
	}
	utils2.cachedProperty = cachedProperty;
	function parseBytes(bytes) {
		return typeof bytes === 'string' ? utils2.toArray(bytes, 'hex') : bytes;
	}
	utils2.parseBytes = parseBytes;
	function intFromLE(bytes) {
		return new BN(bytes, 'hex', 'le');
	}
	utils2.intFromLE = intFromLE;
});
var getNAF = utils_1$1.getNAF;
var getJSF = utils_1$1.getJSF;
var assert$1 = utils_1$1.assert;
function BaseCurve(type, conf) {
	this.type = type;
	this.p = new BN(conf.p, 16);
	this.red = conf.prime ? BN.red(conf.prime) : BN.mont(this.p);
	this.zero = new BN(0).toRed(this.red);
	this.one = new BN(1).toRed(this.red);
	this.two = new BN(2).toRed(this.red);
	this.n = conf.n && new BN(conf.n, 16);
	this.g = conf.g && this.pointFromJSON(conf.g, conf.gRed);
	this._wnafT1 = new Array(4);
	this._wnafT2 = new Array(4);
	this._wnafT3 = new Array(4);
	this._wnafT4 = new Array(4);
	this._bitLength = this.n ? this.n.bitLength() : 0;
	var adjustCount = this.n && this.p.div(this.n);
	if (!adjustCount || adjustCount.cmpn(100) > 0) {
		this.redN = null;
	} else {
		this._maxwellTrick = true;
		this.redN = this.n.toRed(this.red);
	}
}
var base = BaseCurve;
BaseCurve.prototype.point = function point() {
	throw new Error('Not implemented');
};
BaseCurve.prototype.validate = function validate() {
	throw new Error('Not implemented');
};
BaseCurve.prototype._fixedNafMul = function _fixedNafMul(p, k) {
	assert$1(p.precomputed);
	var doubles = p._getDoubles();
	var naf = getNAF(k, 1, this._bitLength);
	var I = (1 << (doubles.step + 1)) - (doubles.step % 2 === 0 ? 2 : 1);
	I /= 3;
	var repr = [];
	var j;
	var nafW;
	for (j = 0; j < naf.length; j += doubles.step) {
		nafW = 0;
		for (var l = j + doubles.step - 1; l >= j; l--) nafW = (nafW << 1) + naf[l];
		repr.push(nafW);
	}
	var a = this.jpoint(null, null, null);
	var b = this.jpoint(null, null, null);
	for (var i = I; i > 0; i--) {
		for (j = 0; j < repr.length; j++) {
			nafW = repr[j];
			if (nafW === i) b = b.mixedAdd(doubles.points[j]);
			else if (nafW === -i) b = b.mixedAdd(doubles.points[j].neg());
		}
		a = a.add(b);
	}
	return a.toP();
};
BaseCurve.prototype._wnafMul = function _wnafMul(p, k) {
	var w = 4;
	var nafPoints = p._getNAFPoints(w);
	w = nafPoints.wnd;
	var wnd = nafPoints.points;
	var naf = getNAF(k, w, this._bitLength);
	var acc = this.jpoint(null, null, null);
	for (var i = naf.length - 1; i >= 0; i--) {
		for (var l = 0; i >= 0 && naf[i] === 0; i--) l++;
		if (i >= 0) l++;
		acc = acc.dblp(l);
		if (i < 0) break;
		var z = naf[i];
		assert$1(z !== 0);
		if (p.type === 'affine') {
			if (z > 0) acc = acc.mixedAdd(wnd[(z - 1) >> 1]);
			else acc = acc.mixedAdd(wnd[(-z - 1) >> 1].neg());
		} else {
			if (z > 0) acc = acc.add(wnd[(z - 1) >> 1]);
			else acc = acc.add(wnd[(-z - 1) >> 1].neg());
		}
	}
	return p.type === 'affine' ? acc.toP() : acc;
};
BaseCurve.prototype._wnafMulAdd = function _wnafMulAdd(defW, points, coeffs, len, jacobianResult) {
	var wndWidth = this._wnafT1;
	var wnd = this._wnafT2;
	var naf = this._wnafT3;
	var max = 0;
	var i;
	var j;
	var p;
	for (i = 0; i < len; i++) {
		p = points[i];
		var nafPoints = p._getNAFPoints(defW);
		wndWidth[i] = nafPoints.wnd;
		wnd[i] = nafPoints.points;
	}
	for (i = len - 1; i >= 1; i -= 2) {
		var a = i - 1;
		var b = i;
		if (wndWidth[a] !== 1 || wndWidth[b] !== 1) {
			naf[a] = getNAF(coeffs[a], wndWidth[a], this._bitLength);
			naf[b] = getNAF(coeffs[b], wndWidth[b], this._bitLength);
			max = Math.max(naf[a].length, max);
			max = Math.max(naf[b].length, max);
			continue;
		}
		var comb = [
			points[a],
			/* 1 */
			null,
			/* 3 */
			null,
			/* 5 */
			points[b],
			/* 7 */
		];
		if (points[a].y.cmp(points[b].y) === 0) {
			comb[1] = points[a].add(points[b]);
			comb[2] = points[a].toJ().mixedAdd(points[b].neg());
		} else if (points[a].y.cmp(points[b].y.redNeg()) === 0) {
			comb[1] = points[a].toJ().mixedAdd(points[b]);
			comb[2] = points[a].add(points[b].neg());
		} else {
			comb[1] = points[a].toJ().mixedAdd(points[b]);
			comb[2] = points[a].toJ().mixedAdd(points[b].neg());
		}
		var index = [
			-3, /* -1 -1 */
			-1, /* -1 0 */
			-5, /* -1 1 */
			-7, /* 0 -1 */
			0, /* 0 0 */
			7, /* 0 1 */
			5, /* 1 -1 */
			1, /* 1 0 */
			3,
			/* 1 1 */
		];
		var jsf = getJSF(coeffs[a], coeffs[b]);
		max = Math.max(jsf[0].length, max);
		naf[a] = new Array(max);
		naf[b] = new Array(max);
		for (j = 0; j < max; j++) {
			var ja = jsf[0][j] | 0;
			var jb = jsf[1][j] | 0;
			naf[a][j] = index[(ja + 1) * 3 + (jb + 1)];
			naf[b][j] = 0;
			wnd[a] = comb;
		}
	}
	var acc = this.jpoint(null, null, null);
	var tmp = this._wnafT4;
	for (i = max; i >= 0; i--) {
		var k = 0;
		while (i >= 0) {
			var zero = true;
			for (j = 0; j < len; j++) {
				tmp[j] = naf[j][i] | 0;
				if (tmp[j] !== 0) zero = false;
			}
			if (!zero) break;
			k++;
			i--;
		}
		if (i >= 0) k++;
		acc = acc.dblp(k);
		if (i < 0) break;
		for (j = 0; j < len; j++) {
			var z = tmp[j];
			if (z === 0) continue;
			else if (z > 0) p = wnd[j][(z - 1) >> 1];
			else if (z < 0) p = wnd[j][(-z - 1) >> 1].neg();
			if (p.type === 'affine') acc = acc.mixedAdd(p);
			else acc = acc.add(p);
		}
	}
	for (i = 0; i < len; i++) wnd[i] = null;
	if (jacobianResult) return acc;
	else return acc.toP();
};
function BasePoint(curve, type) {
	this.curve = curve;
	this.type = type;
	this.precomputed = null;
}
BaseCurve.BasePoint = BasePoint;
BasePoint.prototype.eq = function eq() {
	throw new Error('Not implemented');
};
BasePoint.prototype.validate = function validate2() {
	return this.curve.validate(this);
};
BaseCurve.prototype.decodePoint = function decodePoint(bytes, enc) {
	bytes = utils_1$1.toArray(bytes, enc);
	var len = this.p.byteLength();
	if ((bytes[0] === 4 || bytes[0] === 6 || bytes[0] === 7) && bytes.length - 1 === 2 * len) {
		if (bytes[0] === 6) assert$1(bytes[bytes.length - 1] % 2 === 0);
		else if (bytes[0] === 7) assert$1(bytes[bytes.length - 1] % 2 === 1);
		var res = this.point(bytes.slice(1, 1 + len), bytes.slice(1 + len, 1 + 2 * len));
		return res;
	} else if ((bytes[0] === 2 || bytes[0] === 3) && bytes.length - 1 === len) {
		return this.pointFromX(bytes.slice(1, 1 + len), bytes[0] === 3);
	}
	throw new Error('Unknown point format');
};
BasePoint.prototype.encodeCompressed = function encodeCompressed(enc) {
	return this.encode(enc, true);
};
BasePoint.prototype._encode = function _encode2(compact) {
	var len = this.curve.p.byteLength();
	var x = this.getX().toArray('be', len);
	if (compact) return [this.getY().isEven() ? 2 : 3].concat(x);
	return [4].concat(x, this.getY().toArray('be', len));
};
BasePoint.prototype.encode = function encode2(enc, compact) {
	return utils_1$1.encode(this._encode(compact), enc);
};
BasePoint.prototype.precompute = function precompute(power) {
	if (this.precomputed) return this;
	var precomputed = {
		doubles: null,
		naf: null,
		beta: null,
	};
	precomputed.naf = this._getNAFPoints(8);
	precomputed.doubles = this._getDoubles(4, power);
	precomputed.beta = this._getBeta();
	this.precomputed = precomputed;
	return this;
};
BasePoint.prototype._hasDoubles = function _hasDoubles(k) {
	if (!this.precomputed) return false;
	var doubles = this.precomputed.doubles;
	if (!doubles) return false;
	return doubles.points.length >= Math.ceil((k.bitLength() + 1) / doubles.step);
};
BasePoint.prototype._getDoubles = function _getDoubles(step, power) {
	if (this.precomputed && this.precomputed.doubles) return this.precomputed.doubles;
	var doubles = [this];
	var acc = this;
	for (var i = 0; i < power; i += step) {
		for (var j = 0; j < step; j++) acc = acc.dbl();
		doubles.push(acc);
	}
	return {
		step,
		points: doubles,
	};
};
BasePoint.prototype._getNAFPoints = function _getNAFPoints(wnd) {
	if (this.precomputed && this.precomputed.naf) return this.precomputed.naf;
	var res = [this];
	var max = (1 << wnd) - 1;
	var dbl3 = max === 1 ? null : this.dbl();
	for (var i = 1; i < max; i++) res[i] = res[i - 1].add(dbl3);
	return {
		wnd,
		points: res,
	};
};
BasePoint.prototype._getBeta = function _getBeta() {
	return null;
};
BasePoint.prototype.dblp = function dblp(k) {
	var r2 = this;
	for (var i = 0; i < k; i++) r2 = r2.dbl();
	return r2;
};
var inherits_browser = createCommonjsModule(function (module) {
	if (typeof Object.create === 'function') {
		module.exports = function inherits2(ctor, superCtor) {
			if (superCtor) {
				ctor.super_ = superCtor;
				ctor.prototype = Object.create(superCtor.prototype, {
					constructor: {
						value: ctor,
						enumerable: false,
						writable: true,
						configurable: true,
					},
				});
			}
		};
	} else {
		module.exports = function inherits2(ctor, superCtor) {
			if (superCtor) {
				ctor.super_ = superCtor;
				var TempCtor = function () {};
				TempCtor.prototype = superCtor.prototype;
				ctor.prototype = new TempCtor();
				ctor.prototype.constructor = ctor;
			}
		};
	}
});
var assert$2 = utils_1$1.assert;
function ShortCurve(conf) {
	base.call(this, 'short', conf);
	this.a = new BN(conf.a, 16).toRed(this.red);
	this.b = new BN(conf.b, 16).toRed(this.red);
	this.tinv = this.two.redInvm();
	this.zeroA = this.a.fromRed().cmpn(0) === 0;
	this.threeA = this.a.fromRed().sub(this.p).cmpn(-3) === 0;
	this.endo = this._getEndomorphism(conf);
	this._endoWnafT1 = new Array(4);
	this._endoWnafT2 = new Array(4);
}
inherits_browser(ShortCurve, base);
var short_1 = ShortCurve;
ShortCurve.prototype._getEndomorphism = function _getEndomorphism(conf) {
	if (!this.zeroA || !this.g || !this.n || this.p.modn(3) !== 1) return;
	var beta;
	var lambda;
	if (conf.beta) {
		beta = new BN(conf.beta, 16).toRed(this.red);
	} else {
		var betas = this._getEndoRoots(this.p);
		beta = betas[0].cmp(betas[1]) < 0 ? betas[0] : betas[1];
		beta = beta.toRed(this.red);
	}
	if (conf.lambda) {
		lambda = new BN(conf.lambda, 16);
	} else {
		var lambdas = this._getEndoRoots(this.n);
		if (this.g.mul(lambdas[0]).x.cmp(this.g.x.redMul(beta)) === 0) {
			lambda = lambdas[0];
		} else {
			lambda = lambdas[1];
			assert$2(this.g.mul(lambda).x.cmp(this.g.x.redMul(beta)) === 0);
		}
	}
	var basis;
	if (conf.basis) {
		basis = conf.basis.map(function (vec) {
			return {
				a: new BN(vec.a, 16),
				b: new BN(vec.b, 16),
			};
		});
	} else {
		basis = this._getEndoBasis(lambda);
	}
	return {
		beta,
		lambda,
		basis,
	};
};
ShortCurve.prototype._getEndoRoots = function _getEndoRoots(num) {
	var red = num === this.p ? this.red : BN.mont(num);
	var tinv = new BN(2).toRed(red).redInvm();
	var ntinv = tinv.redNeg();
	var s = new BN(3).toRed(red).redNeg().redSqrt().redMul(tinv);
	var l1 = ntinv.redAdd(s).fromRed();
	var l2 = ntinv.redSub(s).fromRed();
	return [l1, l2];
};
ShortCurve.prototype._getEndoBasis = function _getEndoBasis(lambda) {
	var aprxSqrt = this.n.ushrn(Math.floor(this.n.bitLength() / 2));
	var u = lambda;
	var v = this.n.clone();
	var x1 = new BN(1);
	var y1 = new BN(0);
	var x2 = new BN(0);
	var y2 = new BN(1);
	var a0;
	var b0;
	var a1;
	var b1;
	var a2;
	var b2;
	var prevR;
	var i = 0;
	var r2;
	var x;
	while (u.cmpn(0) !== 0) {
		var q = v.div(u);
		r2 = v.sub(q.mul(u));
		x = x2.sub(q.mul(x1));
		var y = y2.sub(q.mul(y1));
		if (!a1 && r2.cmp(aprxSqrt) < 0) {
			a0 = prevR.neg();
			b0 = x1;
			a1 = r2.neg();
			b1 = x;
		} else if (a1 && ++i === 2) {
			break;
		}
		prevR = r2;
		v = u;
		u = r2;
		x2 = x1;
		x1 = x;
		y2 = y1;
		y1 = y;
	}
	a2 = r2.neg();
	b2 = x;
	var len1 = a1.sqr().add(b1.sqr());
	var len2 = a2.sqr().add(b2.sqr());
	if (len2.cmp(len1) >= 0) {
		a2 = a0;
		b2 = b0;
	}
	if (a1.negative) {
		a1 = a1.neg();
		b1 = b1.neg();
	}
	if (a2.negative) {
		a2 = a2.neg();
		b2 = b2.neg();
	}
	return [
		{ a: a1, b: b1 },
		{ a: a2, b: b2 },
	];
};
ShortCurve.prototype._endoSplit = function _endoSplit(k) {
	var basis = this.endo.basis;
	var v1 = basis[0];
	var v2 = basis[1];
	var c1 = v2.b.mul(k).divRound(this.n);
	var c2 = v1.b.neg().mul(k).divRound(this.n);
	var p1 = c1.mul(v1.a);
	var p2 = c2.mul(v2.a);
	var q1 = c1.mul(v1.b);
	var q2 = c2.mul(v2.b);
	var k1 = k.sub(p1).sub(p2);
	var k2 = q1.add(q2).neg();
	return { k1, k2 };
};
ShortCurve.prototype.pointFromX = function pointFromX(x, odd) {
	x = new BN(x, 16);
	if (!x.red) x = x.toRed(this.red);
	var y2 = x.redSqr().redMul(x).redIAdd(x.redMul(this.a)).redIAdd(this.b);
	var y = y2.redSqrt();
	if (y.redSqr().redSub(y2).cmp(this.zero) !== 0) throw new Error('invalid point');
	var isOdd = y.fromRed().isOdd();
	if ((odd && !isOdd) || (!odd && isOdd)) y = y.redNeg();
	return this.point(x, y);
};
ShortCurve.prototype.validate = function validate3(point3) {
	if (point3.inf) return true;
	var x = point3.x;
	var y = point3.y;
	var ax = this.a.redMul(x);
	var rhs = x.redSqr().redMul(x).redIAdd(ax).redIAdd(this.b);
	return y.redSqr().redISub(rhs).cmpn(0) === 0;
};
ShortCurve.prototype._endoWnafMulAdd = function _endoWnafMulAdd(points, coeffs, jacobianResult) {
	var npoints = this._endoWnafT1;
	var ncoeffs = this._endoWnafT2;
	for (var i = 0; i < points.length; i++) {
		var split = this._endoSplit(coeffs[i]);
		var p = points[i];
		var beta = p._getBeta();
		if (split.k1.negative) {
			split.k1.ineg();
			p = p.neg(true);
		}
		if (split.k2.negative) {
			split.k2.ineg();
			beta = beta.neg(true);
		}
		npoints[i * 2] = p;
		npoints[i * 2 + 1] = beta;
		ncoeffs[i * 2] = split.k1;
		ncoeffs[i * 2 + 1] = split.k2;
	}
	var res = this._wnafMulAdd(1, npoints, ncoeffs, i * 2, jacobianResult);
	for (var j = 0; j < i * 2; j++) {
		npoints[j] = null;
		ncoeffs[j] = null;
	}
	return res;
};
function Point(curve, x, y, isRed) {
	base.BasePoint.call(this, curve, 'affine');
	if (x === null && y === null) {
		this.x = null;
		this.y = null;
		this.inf = true;
	} else {
		this.x = new BN(x, 16);
		this.y = new BN(y, 16);
		if (isRed) {
			this.x.forceRed(this.curve.red);
			this.y.forceRed(this.curve.red);
		}
		if (!this.x.red) this.x = this.x.toRed(this.curve.red);
		if (!this.y.red) this.y = this.y.toRed(this.curve.red);
		this.inf = false;
	}
}
inherits_browser(Point, base.BasePoint);
ShortCurve.prototype.point = function point2(x, y, isRed) {
	return new Point(this, x, y, isRed);
};
ShortCurve.prototype.pointFromJSON = function pointFromJSON(obj, red) {
	return Point.fromJSON(this, obj, red);
};
Point.prototype._getBeta = function _getBeta2() {
	if (!this.curve.endo) return;
	var pre = this.precomputed;
	if (pre && pre.beta) return pre.beta;
	var beta = this.curve.point(this.x.redMul(this.curve.endo.beta), this.y);
	if (pre) {
		var curve = this.curve;
		var endoMul = function (p) {
			return curve.point(p.x.redMul(curve.endo.beta), p.y);
		};
		pre.beta = beta;
		beta.precomputed = {
			beta: null,
			naf: pre.naf && {
				wnd: pre.naf.wnd,
				points: pre.naf.points.map(endoMul),
			},
			doubles: pre.doubles && {
				step: pre.doubles.step,
				points: pre.doubles.points.map(endoMul),
			},
		};
	}
	return beta;
};
Point.prototype.toJSON = function toJSON() {
	if (!this.precomputed) return [this.x, this.y];
	return [
		this.x,
		this.y,
		this.precomputed && {
			doubles: this.precomputed.doubles && {
				step: this.precomputed.doubles.step,
				points: this.precomputed.doubles.points.slice(1),
			},
			naf: this.precomputed.naf && {
				wnd: this.precomputed.naf.wnd,
				points: this.precomputed.naf.points.slice(1),
			},
		},
	];
};
Point.fromJSON = function fromJSON(curve, obj, red) {
	if (typeof obj === 'string') obj = JSON.parse(obj);
	var res = curve.point(obj[0], obj[1], red);
	if (!obj[2]) return res;
	function obj2point(obj2) {
		return curve.point(obj2[0], obj2[1], red);
	}
	var pre = obj[2];
	res.precomputed = {
		beta: null,
		doubles: pre.doubles && {
			step: pre.doubles.step,
			points: [res].concat(pre.doubles.points.map(obj2point)),
		},
		naf: pre.naf && {
			wnd: pre.naf.wnd,
			points: [res].concat(pre.naf.points.map(obj2point)),
		},
	};
	return res;
};
Point.prototype.inspect = function inspect() {
	if (this.isInfinity()) return '<EC Point Infinity>';
	return '<EC Point x: ' + this.x.fromRed().toString(16, 2) + ' y: ' + this.y.fromRed().toString(16, 2) + '>';
};
Point.prototype.isInfinity = function isInfinity() {
	return this.inf;
};
Point.prototype.add = function add(p) {
	if (this.inf) return p;
	if (p.inf) return this;
	if (this.eq(p)) return this.dbl();
	if (this.neg().eq(p)) return this.curve.point(null, null);
	if (this.x.cmp(p.x) === 0) return this.curve.point(null, null);
	var c = this.y.redSub(p.y);
	if (c.cmpn(0) !== 0) c = c.redMul(this.x.redSub(p.x).redInvm());
	var nx = c.redSqr().redISub(this.x).redISub(p.x);
	var ny = c.redMul(this.x.redSub(nx)).redISub(this.y);
	return this.curve.point(nx, ny);
};
Point.prototype.dbl = function dbl() {
	if (this.inf) return this;
	var ys1 = this.y.redAdd(this.y);
	if (ys1.cmpn(0) === 0) return this.curve.point(null, null);
	var a = this.curve.a;
	var x2 = this.x.redSqr();
	var dyinv = ys1.redInvm();
	var c = x2.redAdd(x2).redIAdd(x2).redIAdd(a).redMul(dyinv);
	var nx = c.redSqr().redISub(this.x.redAdd(this.x));
	var ny = c.redMul(this.x.redSub(nx)).redISub(this.y);
	return this.curve.point(nx, ny);
};
Point.prototype.getX = function getX() {
	return this.x.fromRed();
};
Point.prototype.getY = function getY() {
	return this.y.fromRed();
};
Point.prototype.mul = function mul(k) {
	k = new BN(k, 16);
	if (this.isInfinity()) return this;
	else if (this._hasDoubles(k)) return this.curve._fixedNafMul(this, k);
	else if (this.curve.endo) return this.curve._endoWnafMulAdd([this], [k]);
	else return this.curve._wnafMul(this, k);
};
Point.prototype.mulAdd = function mulAdd(k1, p2, k2) {
	var points = [this, p2];
	var coeffs = [k1, k2];
	if (this.curve.endo) return this.curve._endoWnafMulAdd(points, coeffs);
	else return this.curve._wnafMulAdd(1, points, coeffs, 2);
};
Point.prototype.jmulAdd = function jmulAdd(k1, p2, k2) {
	var points = [this, p2];
	var coeffs = [k1, k2];
	if (this.curve.endo) return this.curve._endoWnafMulAdd(points, coeffs, true);
	else return this.curve._wnafMulAdd(1, points, coeffs, 2, true);
};
Point.prototype.eq = function eq2(p) {
	return this === p || (this.inf === p.inf && (this.inf || (this.x.cmp(p.x) === 0 && this.y.cmp(p.y) === 0)));
};
Point.prototype.neg = function neg(_precompute) {
	if (this.inf) return this;
	var res = this.curve.point(this.x, this.y.redNeg());
	if (_precompute && this.precomputed) {
		var pre = this.precomputed;
		var negate = function (p) {
			return p.neg();
		};
		res.precomputed = {
			naf: pre.naf && {
				wnd: pre.naf.wnd,
				points: pre.naf.points.map(negate),
			},
			doubles: pre.doubles && {
				step: pre.doubles.step,
				points: pre.doubles.points.map(negate),
			},
		};
	}
	return res;
};
Point.prototype.toJ = function toJ() {
	if (this.inf) return this.curve.jpoint(null, null, null);
	var res = this.curve.jpoint(this.x, this.y, this.curve.one);
	return res;
};
function JPoint(curve, x, y, z) {
	base.BasePoint.call(this, curve, 'jacobian');
	if (x === null && y === null && z === null) {
		this.x = this.curve.one;
		this.y = this.curve.one;
		this.z = new BN(0);
	} else {
		this.x = new BN(x, 16);
		this.y = new BN(y, 16);
		this.z = new BN(z, 16);
	}
	if (!this.x.red) this.x = this.x.toRed(this.curve.red);
	if (!this.y.red) this.y = this.y.toRed(this.curve.red);
	if (!this.z.red) this.z = this.z.toRed(this.curve.red);
	this.zOne = this.z === this.curve.one;
}
inherits_browser(JPoint, base.BasePoint);
ShortCurve.prototype.jpoint = function jpoint(x, y, z) {
	return new JPoint(this, x, y, z);
};
JPoint.prototype.toP = function toP() {
	if (this.isInfinity()) return this.curve.point(null, null);
	var zinv = this.z.redInvm();
	var zinv2 = zinv.redSqr();
	var ax = this.x.redMul(zinv2);
	var ay = this.y.redMul(zinv2).redMul(zinv);
	return this.curve.point(ax, ay);
};
JPoint.prototype.neg = function neg2() {
	return this.curve.jpoint(this.x, this.y.redNeg(), this.z);
};
JPoint.prototype.add = function add2(p) {
	if (this.isInfinity()) return p;
	if (p.isInfinity()) return this;
	var pz2 = p.z.redSqr();
	var z2 = this.z.redSqr();
	var u1 = this.x.redMul(pz2);
	var u2 = p.x.redMul(z2);
	var s1 = this.y.redMul(pz2.redMul(p.z));
	var s2 = p.y.redMul(z2.redMul(this.z));
	var h = u1.redSub(u2);
	var r2 = s1.redSub(s2);
	if (h.cmpn(0) === 0) {
		if (r2.cmpn(0) !== 0) return this.curve.jpoint(null, null, null);
		else return this.dbl();
	}
	var h2 = h.redSqr();
	var h3 = h2.redMul(h);
	var v = u1.redMul(h2);
	var nx = r2.redSqr().redIAdd(h3).redISub(v).redISub(v);
	var ny = r2.redMul(v.redISub(nx)).redISub(s1.redMul(h3));
	var nz = this.z.redMul(p.z).redMul(h);
	return this.curve.jpoint(nx, ny, nz);
};
JPoint.prototype.mixedAdd = function mixedAdd(p) {
	if (this.isInfinity()) return p.toJ();
	if (p.isInfinity()) return this;
	var z2 = this.z.redSqr();
	var u1 = this.x;
	var u2 = p.x.redMul(z2);
	var s1 = this.y;
	var s2 = p.y.redMul(z2).redMul(this.z);
	var h = u1.redSub(u2);
	var r2 = s1.redSub(s2);
	if (h.cmpn(0) === 0) {
		if (r2.cmpn(0) !== 0) return this.curve.jpoint(null, null, null);
		else return this.dbl();
	}
	var h2 = h.redSqr();
	var h3 = h2.redMul(h);
	var v = u1.redMul(h2);
	var nx = r2.redSqr().redIAdd(h3).redISub(v).redISub(v);
	var ny = r2.redMul(v.redISub(nx)).redISub(s1.redMul(h3));
	var nz = this.z.redMul(h);
	return this.curve.jpoint(nx, ny, nz);
};
JPoint.prototype.dblp = function dblp2(pow) {
	if (pow === 0) return this;
	if (this.isInfinity()) return this;
	if (!pow) return this.dbl();
	var i;
	if (this.curve.zeroA || this.curve.threeA) {
		var r2 = this;
		for (i = 0; i < pow; i++) r2 = r2.dbl();
		return r2;
	}
	var a = this.curve.a;
	var tinv = this.curve.tinv;
	var jx = this.x;
	var jy = this.y;
	var jz = this.z;
	var jz4 = jz.redSqr().redSqr();
	var jyd = jy.redAdd(jy);
	for (i = 0; i < pow; i++) {
		var jx2 = jx.redSqr();
		var jyd2 = jyd.redSqr();
		var jyd4 = jyd2.redSqr();
		var c = jx2.redAdd(jx2).redIAdd(jx2).redIAdd(a.redMul(jz4));
		var t1 = jx.redMul(jyd2);
		var nx = c.redSqr().redISub(t1.redAdd(t1));
		var t2 = t1.redISub(nx);
		var dny = c.redMul(t2);
		dny = dny.redIAdd(dny).redISub(jyd4);
		var nz = jyd.redMul(jz);
		if (i + 1 < pow) jz4 = jz4.redMul(jyd4);
		jx = nx;
		jz = nz;
		jyd = dny;
	}
	return this.curve.jpoint(jx, jyd.redMul(tinv), jz);
};
JPoint.prototype.dbl = function dbl2() {
	if (this.isInfinity()) return this;
	if (this.curve.zeroA) return this._zeroDbl();
	else if (this.curve.threeA) return this._threeDbl();
	else return this._dbl();
};
JPoint.prototype._zeroDbl = function _zeroDbl() {
	var nx;
	var ny;
	var nz;
	if (this.zOne) {
		var xx = this.x.redSqr();
		var yy = this.y.redSqr();
		var yyyy = yy.redSqr();
		var s = this.x.redAdd(yy).redSqr().redISub(xx).redISub(yyyy);
		s = s.redIAdd(s);
		var m = xx.redAdd(xx).redIAdd(xx);
		var t = m.redSqr().redISub(s).redISub(s);
		var yyyy8 = yyyy.redIAdd(yyyy);
		yyyy8 = yyyy8.redIAdd(yyyy8);
		yyyy8 = yyyy8.redIAdd(yyyy8);
		nx = t;
		ny = m.redMul(s.redISub(t)).redISub(yyyy8);
		nz = this.y.redAdd(this.y);
	} else {
		var a = this.x.redSqr();
		var b = this.y.redSqr();
		var c = b.redSqr();
		var d = this.x.redAdd(b).redSqr().redISub(a).redISub(c);
		d = d.redIAdd(d);
		var e = a.redAdd(a).redIAdd(a);
		var f = e.redSqr();
		var c8 = c.redIAdd(c);
		c8 = c8.redIAdd(c8);
		c8 = c8.redIAdd(c8);
		nx = f.redISub(d).redISub(d);
		ny = e.redMul(d.redISub(nx)).redISub(c8);
		nz = this.y.redMul(this.z);
		nz = nz.redIAdd(nz);
	}
	return this.curve.jpoint(nx, ny, nz);
};
JPoint.prototype._threeDbl = function _threeDbl() {
	var nx;
	var ny;
	var nz;
	if (this.zOne) {
		var xx = this.x.redSqr();
		var yy = this.y.redSqr();
		var yyyy = yy.redSqr();
		var s = this.x.redAdd(yy).redSqr().redISub(xx).redISub(yyyy);
		s = s.redIAdd(s);
		var m = xx.redAdd(xx).redIAdd(xx).redIAdd(this.curve.a);
		var t = m.redSqr().redISub(s).redISub(s);
		nx = t;
		var yyyy8 = yyyy.redIAdd(yyyy);
		yyyy8 = yyyy8.redIAdd(yyyy8);
		yyyy8 = yyyy8.redIAdd(yyyy8);
		ny = m.redMul(s.redISub(t)).redISub(yyyy8);
		nz = this.y.redAdd(this.y);
	} else {
		var delta = this.z.redSqr();
		var gamma = this.y.redSqr();
		var beta = this.x.redMul(gamma);
		var alpha = this.x.redSub(delta).redMul(this.x.redAdd(delta));
		alpha = alpha.redAdd(alpha).redIAdd(alpha);
		var beta4 = beta.redIAdd(beta);
		beta4 = beta4.redIAdd(beta4);
		var beta8 = beta4.redAdd(beta4);
		nx = alpha.redSqr().redISub(beta8);
		nz = this.y.redAdd(this.z).redSqr().redISub(gamma).redISub(delta);
		var ggamma8 = gamma.redSqr();
		ggamma8 = ggamma8.redIAdd(ggamma8);
		ggamma8 = ggamma8.redIAdd(ggamma8);
		ggamma8 = ggamma8.redIAdd(ggamma8);
		ny = alpha.redMul(beta4.redISub(nx)).redISub(ggamma8);
	}
	return this.curve.jpoint(nx, ny, nz);
};
JPoint.prototype._dbl = function _dbl() {
	var a = this.curve.a;
	var jx = this.x;
	var jy = this.y;
	var jz = this.z;
	var jz4 = jz.redSqr().redSqr();
	var jx2 = jx.redSqr();
	var jy2 = jy.redSqr();
	var c = jx2.redAdd(jx2).redIAdd(jx2).redIAdd(a.redMul(jz4));
	var jxd4 = jx.redAdd(jx);
	jxd4 = jxd4.redIAdd(jxd4);
	var t1 = jxd4.redMul(jy2);
	var nx = c.redSqr().redISub(t1.redAdd(t1));
	var t2 = t1.redISub(nx);
	var jyd8 = jy2.redSqr();
	jyd8 = jyd8.redIAdd(jyd8);
	jyd8 = jyd8.redIAdd(jyd8);
	jyd8 = jyd8.redIAdd(jyd8);
	var ny = c.redMul(t2).redISub(jyd8);
	var nz = jy.redAdd(jy).redMul(jz);
	return this.curve.jpoint(nx, ny, nz);
};
JPoint.prototype.trpl = function trpl() {
	if (!this.curve.zeroA) return this.dbl().add(this);
	var xx = this.x.redSqr();
	var yy = this.y.redSqr();
	var zz = this.z.redSqr();
	var yyyy = yy.redSqr();
	var m = xx.redAdd(xx).redIAdd(xx);
	var mm = m.redSqr();
	var e = this.x.redAdd(yy).redSqr().redISub(xx).redISub(yyyy);
	e = e.redIAdd(e);
	e = e.redAdd(e).redIAdd(e);
	e = e.redISub(mm);
	var ee = e.redSqr();
	var t = yyyy.redIAdd(yyyy);
	t = t.redIAdd(t);
	t = t.redIAdd(t);
	t = t.redIAdd(t);
	var u = m.redIAdd(e).redSqr().redISub(mm).redISub(ee).redISub(t);
	var yyu4 = yy.redMul(u);
	yyu4 = yyu4.redIAdd(yyu4);
	yyu4 = yyu4.redIAdd(yyu4);
	var nx = this.x.redMul(ee).redISub(yyu4);
	nx = nx.redIAdd(nx);
	nx = nx.redIAdd(nx);
	var ny = this.y.redMul(u.redMul(t.redISub(u)).redISub(e.redMul(ee)));
	ny = ny.redIAdd(ny);
	ny = ny.redIAdd(ny);
	ny = ny.redIAdd(ny);
	var nz = this.z.redAdd(e).redSqr().redISub(zz).redISub(ee);
	return this.curve.jpoint(nx, ny, nz);
};
JPoint.prototype.mul = function mul2(k, kbase) {
	k = new BN(k, kbase);
	return this.curve._wnafMul(this, k);
};
JPoint.prototype.eq = function eq3(p) {
	if (p.type === 'affine') return this.eq(p.toJ());
	if (this === p) return true;
	var z2 = this.z.redSqr();
	var pz2 = p.z.redSqr();
	if (this.x.redMul(pz2).redISub(p.x.redMul(z2)).cmpn(0) !== 0) return false;
	var z3 = z2.redMul(this.z);
	var pz3 = pz2.redMul(p.z);
	return this.y.redMul(pz3).redISub(p.y.redMul(z3)).cmpn(0) === 0;
};
JPoint.prototype.eqXToP = function eqXToP(x) {
	var zs = this.z.redSqr();
	var rx = x.toRed(this.curve.red).redMul(zs);
	if (this.x.cmp(rx) === 0) return true;
	var xc = x.clone();
	var t = this.curve.redN.redMul(zs);
	for (;;) {
		xc.iadd(this.curve.n);
		if (xc.cmp(this.curve.p) >= 0) return false;
		rx.redIAdd(t);
		if (this.x.cmp(rx) === 0) return true;
	}
};
JPoint.prototype.inspect = function inspect2() {
	if (this.isInfinity()) return '<EC JPoint Infinity>';
	return '<EC JPoint x: ' + this.x.toString(16, 2) + ' y: ' + this.y.toString(16, 2) + ' z: ' + this.z.toString(16, 2) + '>';
};
JPoint.prototype.isInfinity = function isInfinity2() {
	return this.z.cmpn(0) === 0;
};
var curve_1 = createCommonjsModule(function (module, exports) {
	var curve = exports;
	curve.base = base;
	curve.short = short_1;
	curve.mont = /*RicMoo:ethers:require(./mont)*/ null;
	curve.edwards = /*RicMoo:ethers:require(./edwards)*/ null;
});
var curves_1 = createCommonjsModule(function (module, exports) {
	var curves = exports;
	var assert2 = utils_1$1.assert;
	function PresetCurve(options) {
		if (options.type === 'short') this.curve = new curve_1.short(options);
		else if (options.type === 'edwards') this.curve = new curve_1.edwards(options);
		else this.curve = new curve_1.mont(options);
		this.g = this.curve.g;
		this.n = this.curve.n;
		this.hash = options.hash;
		assert2(this.g.validate(), 'Invalid curve');
		assert2(this.g.mul(this.n).isInfinity(), 'Invalid curve, G*N != O');
	}
	curves.PresetCurve = PresetCurve;
	function defineCurve(name, options) {
		Object.defineProperty(curves, name, {
			configurable: true,
			enumerable: true,
			get: function () {
				var curve = new PresetCurve(options);
				Object.defineProperty(curves, name, {
					configurable: true,
					enumerable: true,
					value: curve,
				});
				return curve;
			},
		});
	}
	defineCurve('p192', {
		type: 'short',
		prime: 'p192',
		p: 'ffffffff ffffffff ffffffff fffffffe ffffffff ffffffff',
		a: 'ffffffff ffffffff ffffffff fffffffe ffffffff fffffffc',
		b: '64210519 e59c80e7 0fa7e9ab 72243049 feb8deec c146b9b1',
		n: 'ffffffff ffffffff ffffffff 99def836 146bc9b1 b4d22831',
		hash: hash.sha256,
		gRed: false,
		g: ['188da80e b03090f6 7cbf20eb 43a18800 f4ff0afd 82ff1012', '07192b95 ffc8da78 631011ed 6b24cdd5 73f977a1 1e794811'],
	});
	defineCurve('p224', {
		type: 'short',
		prime: 'p224',
		p: 'ffffffff ffffffff ffffffff ffffffff 00000000 00000000 00000001',
		a: 'ffffffff ffffffff ffffffff fffffffe ffffffff ffffffff fffffffe',
		b: 'b4050a85 0c04b3ab f5413256 5044b0b7 d7bfd8ba 270b3943 2355ffb4',
		n: 'ffffffff ffffffff ffffffff ffff16a2 e0b8f03e 13dd2945 5c5c2a3d',
		hash: hash.sha256,
		gRed: false,
		g: ['b70e0cbd 6bb4bf7f 321390b9 4a03c1d3 56c21122 343280d6 115c1d21', 'bd376388 b5f723fb 4c22dfe6 cd4375a0 5a074764 44d58199 85007e34'],
	});
	defineCurve('p256', {
		type: 'short',
		prime: null,
		p: 'ffffffff 00000001 00000000 00000000 00000000 ffffffff ffffffff ffffffff',
		a: 'ffffffff 00000001 00000000 00000000 00000000 ffffffff ffffffff fffffffc',
		b: '5ac635d8 aa3a93e7 b3ebbd55 769886bc 651d06b0 cc53b0f6 3bce3c3e 27d2604b',
		n: 'ffffffff 00000000 ffffffff ffffffff bce6faad a7179e84 f3b9cac2 fc632551',
		hash: hash.sha256,
		gRed: false,
		g: [
			'6b17d1f2 e12c4247 f8bce6e5 63a440f2 77037d81 2deb33a0 f4a13945 d898c296',
			'4fe342e2 fe1a7f9b 8ee7eb4a 7c0f9e16 2bce3357 6b315ece cbb64068 37bf51f5',
		],
	});
	defineCurve('p384', {
		type: 'short',
		prime: null,
		p: 'ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff fffffffe ffffffff 00000000 00000000 ffffffff',
		a: 'ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff fffffffe ffffffff 00000000 00000000 fffffffc',
		b: 'b3312fa7 e23ee7e4 988e056b e3f82d19 181d9c6e fe814112 0314088f 5013875a c656398d 8a2ed19d 2a85c8ed d3ec2aef',
		n: 'ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff c7634d81 f4372ddf 581a0db2 48b0a77a ecec196a ccc52973',
		hash: hash.sha384,
		gRed: false,
		g: [
			'aa87ca22 be8b0537 8eb1c71e f320ad74 6e1d3b62 8ba79b98 59f741e0 82542a38 5502f25d bf55296c 3a545e38 72760ab7',
			'3617de4a 96262c6f 5d9e98bf 9292dc29 f8f41dbd 289a147c e9da3113 b5f0b8c0 0a60b1ce 1d7e819d 7a431d7c 90ea0e5f',
		],
	});
	defineCurve('p521', {
		type: 'short',
		prime: null,
		p: '000001ff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff',
		a: '000001ff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff fffffffc',
		b: '00000051 953eb961 8e1c9a1f 929a21a0 b68540ee a2da725b 99b315f3 b8b48991 8ef109e1 56193951 ec7e937b 1652c0bd 3bb1bf07 3573df88 3d2c34f1 ef451fd4 6b503f00',
		n: '000001ff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff fffffffa 51868783 bf2f966b 7fcc0148 f709a5d0 3bb5c9b8 899c47ae bb6fb71e 91386409',
		hash: hash.sha512,
		gRed: false,
		g: [
			'000000c6 858e06b7 0404e9cd 9e3ecb66 2395b442 9c648139 053fb521 f828af60 6b4d3dba a14b5e77 efe75928 fe1dc127 a2ffa8de 3348b3c1 856a429b f97e7e31 c2e5bd66',
			'00000118 39296a78 9a3bc004 5c8a5fb4 2c7d1bd9 98f54449 579b4468 17afbd17 273e662c 97ee7299 5ef42640 c550b901 3fad0761 353c7086 a272c240 88be9476 9fd16650',
		],
	});
	defineCurve('curve25519', {
		type: 'mont',
		prime: 'p25519',
		p: '7fffffffffffffff ffffffffffffffff ffffffffffffffff ffffffffffffffed',
		a: '76d06',
		b: '1',
		n: '1000000000000000 0000000000000000 14def9dea2f79cd6 5812631a5cf5d3ed',
		hash: hash.sha256,
		gRed: false,
		g: ['9'],
	});
	defineCurve('ed25519', {
		type: 'edwards',
		prime: 'p25519',
		p: '7fffffffffffffff ffffffffffffffff ffffffffffffffff ffffffffffffffed',
		a: '-1',
		c: '1',
		// -121665 * (121666^(-1)) (mod P)
		d: '52036cee2b6ffe73 8cc740797779e898 00700a4d4141d8ab 75eb4dca135978a3',
		n: '1000000000000000 0000000000000000 14def9dea2f79cd6 5812631a5cf5d3ed',
		hash: hash.sha256,
		gRed: false,
		g: [
			'216936d3cd6e53fec0a4e231fdd6dc5c692cc7609525a7b2c9562d608f25d51a',
			// 4/5
			'6666666666666666666666666666666666666666666666666666666666666658',
		],
	});
	var pre;
	try {
		pre = /*RicMoo:ethers:require(./precomputed/secp256k1)*/ null.crash();
	} catch (e) {
		pre = void 0;
	}
	defineCurve('secp256k1', {
		type: 'short',
		prime: 'k256',
		p: 'ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff fffffffe fffffc2f',
		a: '0',
		b: '7',
		n: 'ffffffff ffffffff ffffffff fffffffe baaedce6 af48a03b bfd25e8c d0364141',
		h: '1',
		hash: hash.sha256,
		// Precomputed endomorphism
		beta: '7ae96a2b657c07106e64479eac3434e99cf0497512f58995c1396c28719501ee',
		lambda: '5363ad4cc05c30e0a5261c028812645a122e22ea20816678df02967c1b23bd72',
		basis: [
			{
				a: '3086d221a7d46bcde86c90e49284eb15',
				b: '-e4437ed6010e88286f547fa90abfe4c3',
			},
			{
				a: '114ca50f7a8e2f3f657c1108d9d44cfd8',
				b: '3086d221a7d46bcde86c90e49284eb15',
			},
		],
		gRed: false,
		g: [
			'79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798',
			'483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8',
			pre,
		],
	});
});
function HmacDRBG(options) {
	if (!(this instanceof HmacDRBG)) return new HmacDRBG(options);
	this.hash = options.hash;
	this.predResist = !!options.predResist;
	this.outLen = this.hash.outSize;
	this.minEntropy = options.minEntropy || this.hash.hmacStrength;
	this._reseed = null;
	this.reseedInterval = null;
	this.K = null;
	this.V = null;
	var entropy = utils_1.toArray(options.entropy, options.entropyEnc || 'hex');
	var nonce = utils_1.toArray(options.nonce, options.nonceEnc || 'hex');
	var pers = utils_1.toArray(options.pers, options.persEnc || 'hex');
	minimalisticAssert(entropy.length >= this.minEntropy / 8, 'Not enough entropy. Minimum is: ' + this.minEntropy + ' bits');
	this._init(entropy, nonce, pers);
}
var hmacDrbg = HmacDRBG;
HmacDRBG.prototype._init = function init(entropy, nonce, pers) {
	var seed = entropy.concat(nonce).concat(pers);
	this.K = new Array(this.outLen / 8);
	this.V = new Array(this.outLen / 8);
	for (var i = 0; i < this.V.length; i++) {
		this.K[i] = 0;
		this.V[i] = 1;
	}
	this._update(seed);
	this._reseed = 1;
	this.reseedInterval = 281474976710656;
};
HmacDRBG.prototype._hmac = function hmac2() {
	return new hash.hmac(this.hash, this.K);
};
HmacDRBG.prototype._update = function update(seed) {
	var kmac = this._hmac().update(this.V).update([0]);
	if (seed) kmac = kmac.update(seed);
	this.K = kmac.digest();
	this.V = this._hmac().update(this.V).digest();
	if (!seed) return;
	this.K = this._hmac().update(this.V).update([1]).update(seed).digest();
	this.V = this._hmac().update(this.V).digest();
};
HmacDRBG.prototype.reseed = function reseed(entropy, entropyEnc, add3, addEnc) {
	if (typeof entropyEnc !== 'string') {
		addEnc = add3;
		add3 = entropyEnc;
		entropyEnc = null;
	}
	entropy = utils_1.toArray(entropy, entropyEnc);
	add3 = utils_1.toArray(add3, addEnc);
	minimalisticAssert(entropy.length >= this.minEntropy / 8, 'Not enough entropy. Minimum is: ' + this.minEntropy + ' bits');
	this._update(entropy.concat(add3 || []));
	this._reseed = 1;
};
HmacDRBG.prototype.generate = function generate(len, enc, add3, addEnc) {
	if (this._reseed > this.reseedInterval) throw new Error('Reseed is required');
	if (typeof enc !== 'string') {
		addEnc = add3;
		add3 = enc;
		enc = null;
	}
	if (add3) {
		add3 = utils_1.toArray(add3, addEnc || 'hex');
		this._update(add3);
	}
	var temp = [];
	while (temp.length < len) {
		this.V = this._hmac().update(this.V).digest();
		temp = temp.concat(this.V);
	}
	var res = temp.slice(0, len);
	this._update(add3);
	this._reseed++;
	return utils_1.encode(res, enc);
};
var assert$3 = utils_1$1.assert;
function KeyPair(ec2, options) {
	this.ec = ec2;
	this.priv = null;
	this.pub = null;
	if (options.priv) this._importPrivate(options.priv, options.privEnc);
	if (options.pub) this._importPublic(options.pub, options.pubEnc);
}
var key = KeyPair;
KeyPair.fromPublic = function fromPublic(ec2, pub, enc) {
	if (pub instanceof KeyPair) return pub;
	return new KeyPair(ec2, {
		pub,
		pubEnc: enc,
	});
};
KeyPair.fromPrivate = function fromPrivate(ec2, priv, enc) {
	if (priv instanceof KeyPair) return priv;
	return new KeyPair(ec2, {
		priv,
		privEnc: enc,
	});
};
KeyPair.prototype.validate = function validate4() {
	var pub = this.getPublic();
	if (pub.isInfinity()) return { result: false, reason: 'Invalid public key' };
	if (!pub.validate()) return { result: false, reason: 'Public key is not a point' };
	if (!pub.mul(this.ec.curve.n).isInfinity()) return { result: false, reason: 'Public key * N != O' };
	return { result: true, reason: null };
};
KeyPair.prototype.getPublic = function getPublic(compact, enc) {
	if (typeof compact === 'string') {
		enc = compact;
		compact = null;
	}
	if (!this.pub) this.pub = this.ec.g.mul(this.priv);
	if (!enc) return this.pub;
	return this.pub.encode(enc, compact);
};
KeyPair.prototype.getPrivate = function getPrivate(enc) {
	if (enc === 'hex') return this.priv.toString(16, 2);
	else return this.priv;
};
KeyPair.prototype._importPrivate = function _importPrivate(key2, enc) {
	this.priv = new BN(key2, enc || 16);
	this.priv = this.priv.umod(this.ec.curve.n);
};
KeyPair.prototype._importPublic = function _importPublic(key2, enc) {
	if (key2.x || key2.y) {
		if (this.ec.curve.type === 'mont') {
			assert$3(key2.x, 'Need x coordinate');
		} else if (this.ec.curve.type === 'short' || this.ec.curve.type === 'edwards') {
			assert$3(key2.x && key2.y, 'Need both x and y coordinate');
		}
		this.pub = this.ec.curve.point(key2.x, key2.y);
		return;
	}
	this.pub = this.ec.curve.decodePoint(key2, enc);
};
KeyPair.prototype.derive = function derive(pub) {
	if (!pub.validate()) {
		assert$3(pub.validate(), 'public point not validated');
	}
	return pub.mul(this.priv).getX();
};
KeyPair.prototype.sign = function sign(msg, enc, options) {
	return this.ec.sign(msg, this, enc, options);
};
KeyPair.prototype.verify = function verify(msg, signature2, options) {
	return this.ec.verify(msg, signature2, this, void 0, options);
};
KeyPair.prototype.inspect = function inspect3() {
	return '<Key priv: ' + (this.priv && this.priv.toString(16, 2)) + ' pub: ' + (this.pub && this.pub.inspect()) + ' >';
};
var assert$4 = utils_1$1.assert;
function Signature(options, enc) {
	if (options instanceof Signature) return options;
	if (this._importDER(options, enc)) return;
	assert$4(options.r && options.s, 'Signature without r or s');
	this.r = new BN(options.r, 16);
	this.s = new BN(options.s, 16);
	if (options.recoveryParam === void 0) this.recoveryParam = null;
	else this.recoveryParam = options.recoveryParam;
}
var signature = Signature;
function Position() {
	this.place = 0;
}
function getLength(buf, p) {
	var initial = buf[p.place++];
	if (!(initial & 128)) {
		return initial;
	}
	var octetLen = initial & 15;
	if (octetLen === 0 || octetLen > 4) {
		return false;
	}
	if (buf[p.place] === 0) {
		return false;
	}
	var val = 0;
	for (var i = 0, off = p.place; i < octetLen; i++, off++) {
		val <<= 8;
		val |= buf[off];
		val >>>= 0;
	}
	if (val <= 127) {
		return false;
	}
	p.place = off;
	return val;
}
function rmPadding(buf) {
	var i = 0;
	var len = buf.length - 1;
	while (!buf[i] && !(buf[i + 1] & 128) && i < len) {
		i++;
	}
	if (i === 0) {
		return buf;
	}
	return buf.slice(i);
}
Signature.prototype._importDER = function _importDER(data, enc) {
	data = utils_1$1.toArray(data, enc);
	var p = new Position();
	if (data[p.place++] !== 48) {
		return false;
	}
	var len = getLength(data, p);
	if (len === false) {
		return false;
	}
	if (len + p.place !== data.length) {
		return false;
	}
	if (data[p.place++] !== 2) {
		return false;
	}
	var rlen = getLength(data, p);
	if (rlen === false) {
		return false;
	}
	if ((data[p.place] & 128) !== 0) {
		return false;
	}
	var r2 = data.slice(p.place, rlen + p.place);
	p.place += rlen;
	if (data[p.place++] !== 2) {
		return false;
	}
	var slen = getLength(data, p);
	if (slen === false) {
		return false;
	}
	if (data.length !== slen + p.place) {
		return false;
	}
	if ((data[p.place] & 128) !== 0) {
		return false;
	}
	var s = data.slice(p.place, slen + p.place);
	if (r2[0] === 0) {
		if (r2[1] & 128) {
			r2 = r2.slice(1);
		} else {
			return false;
		}
	}
	if (s[0] === 0) {
		if (s[1] & 128) {
			s = s.slice(1);
		} else {
			return false;
		}
	}
	this.r = new BN(r2);
	this.s = new BN(s);
	this.recoveryParam = null;
	return true;
};
function constructLength(arr, len) {
	if (len < 128) {
		arr.push(len);
		return;
	}
	var octets = 1 + ((Math.log(len) / Math.LN2) >>> 3);
	arr.push(octets | 128);
	while (--octets) {
		arr.push((len >>> (octets << 3)) & 255);
	}
	arr.push(len);
}
Signature.prototype.toDER = function toDER(enc) {
	var r2 = this.r.toArray();
	var s = this.s.toArray();
	if (r2[0] & 128) r2 = [0].concat(r2);
	if (s[0] & 128) s = [0].concat(s);
	r2 = rmPadding(r2);
	s = rmPadding(s);
	while (!s[0] && !(s[1] & 128)) {
		s = s.slice(1);
	}
	var arr = [2];
	constructLength(arr, r2.length);
	arr = arr.concat(r2);
	arr.push(2);
	constructLength(arr, s.length);
	var backHalf = arr.concat(s);
	var res = [48];
	constructLength(res, backHalf.length);
	res = res.concat(backHalf);
	return utils_1$1.encode(res, enc);
};
var rand =
	/*RicMoo:ethers:require(brorand)*/
	function () {
		throw new Error('unsupported');
	};
var assert$5 = utils_1$1.assert;
function EC(options) {
	if (!(this instanceof EC)) return new EC(options);
	if (typeof options === 'string') {
		assert$5(Object.prototype.hasOwnProperty.call(curves_1, options), 'Unknown curve ' + options);
		options = curves_1[options];
	}
	if (options instanceof curves_1.PresetCurve) options = { curve: options };
	this.curve = options.curve.curve;
	this.n = this.curve.n;
	this.nh = this.n.ushrn(1);
	this.g = this.curve.g;
	this.g = options.curve.g;
	this.g.precompute(options.curve.n.bitLength() + 1);
	this.hash = options.hash || options.curve.hash;
}
var ec = EC;
EC.prototype.keyPair = function keyPair(options) {
	return new key(this, options);
};
EC.prototype.keyFromPrivate = function keyFromPrivate(priv, enc) {
	return key.fromPrivate(this, priv, enc);
};
EC.prototype.keyFromPublic = function keyFromPublic(pub, enc) {
	return key.fromPublic(this, pub, enc);
};
EC.prototype.genKeyPair = function genKeyPair(options) {
	if (!options) options = {};
	var drbg = new hmacDrbg({
		hash: this.hash,
		pers: options.pers,
		persEnc: options.persEnc || 'utf8',
		entropy: options.entropy || rand(this.hash.hmacStrength),
		entropyEnc: (options.entropy && options.entropyEnc) || 'utf8',
		nonce: this.n.toArray(),
	});
	var bytes = this.n.byteLength();
	var ns2 = this.n.sub(new BN(2));
	for (;;) {
		var priv = new BN(drbg.generate(bytes));
		if (priv.cmp(ns2) > 0) continue;
		priv.iaddn(1);
		return this.keyFromPrivate(priv);
	}
};
EC.prototype._truncateToN = function _truncateToN(msg, truncOnly, bitLength) {
	var byteLength;
	if (BN.isBN(msg) || typeof msg === 'number') {
		msg = new BN(msg, 16);
		byteLength = msg.byteLength();
	} else if (typeof msg === 'object') {
		byteLength = msg.length;
		msg = new BN(msg, 16);
	} else {
		var str = msg.toString();
		byteLength = (str.length + 1) >>> 1;
		msg = new BN(str, 16);
	}
	if (typeof bitLength !== 'number') {
		bitLength = byteLength * 8;
	}
	var delta = bitLength - this.n.bitLength();
	if (delta > 0) msg = msg.ushrn(delta);
	if (!truncOnly && msg.cmp(this.n) >= 0) return msg.sub(this.n);
	else return msg;
};
EC.prototype.sign = function sign2(msg, key2, enc, options) {
	if (typeof enc === 'object') {
		options = enc;
		enc = null;
	}
	if (!options) options = {};
	if (typeof msg !== 'string' && typeof msg !== 'number' && !BN.isBN(msg)) {
		assert$5(
			typeof msg === 'object' && msg && typeof msg.length === 'number',
			'Expected message to be an array-like, a hex string, or a BN instance',
		);
		assert$5(msg.length >>> 0 === msg.length);
		for (var i = 0; i < msg.length; i++) assert$5((msg[i] & 255) === msg[i]);
	}
	key2 = this.keyFromPrivate(key2, enc);
	msg = this._truncateToN(msg, false, options.msgBitLength);
	assert$5(!msg.isNeg(), 'Can not sign a negative message');
	var bytes = this.n.byteLength();
	var bkey = key2.getPrivate().toArray('be', bytes);
	var nonce = msg.toArray('be', bytes);
	assert$5(new BN(nonce).eq(msg), 'Can not sign message');
	var drbg = new hmacDrbg({
		hash: this.hash,
		entropy: bkey,
		nonce,
		pers: options.pers,
		persEnc: options.persEnc || 'utf8',
	});
	var ns1 = this.n.sub(new BN(1));
	for (var iter = 0; ; iter++) {
		var k = options.k ? options.k(iter) : new BN(drbg.generate(this.n.byteLength()));
		k = this._truncateToN(k, true);
		if (k.cmpn(1) <= 0 || k.cmp(ns1) >= 0) continue;
		var kp = this.g.mul(k);
		if (kp.isInfinity()) continue;
		var kpX = kp.getX();
		var r2 = kpX.umod(this.n);
		if (r2.cmpn(0) === 0) continue;
		var s = k.invm(this.n).mul(r2.mul(key2.getPrivate()).iadd(msg));
		s = s.umod(this.n);
		if (s.cmpn(0) === 0) continue;
		var recoveryParam = (kp.getY().isOdd() ? 1 : 0) | (kpX.cmp(r2) !== 0 ? 2 : 0);
		if (options.canonical && s.cmp(this.nh) > 0) {
			s = this.n.sub(s);
			recoveryParam ^= 1;
		}
		return new signature({ r: r2, s, recoveryParam });
	}
};
EC.prototype.verify = function verify2(msg, signature$1, key2, enc, options) {
	if (!options) options = {};
	msg = this._truncateToN(msg, false, options.msgBitLength);
	key2 = this.keyFromPublic(key2, enc);
	signature$1 = new signature(signature$1, 'hex');
	var r2 = signature$1.r;
	var s = signature$1.s;
	if (r2.cmpn(1) < 0 || r2.cmp(this.n) >= 0) return false;
	if (s.cmpn(1) < 0 || s.cmp(this.n) >= 0) return false;
	var sinv = s.invm(this.n);
	var u1 = sinv.mul(msg).umod(this.n);
	var u2 = sinv.mul(r2).umod(this.n);
	var p;
	if (!this.curve._maxwellTrick) {
		p = this.g.mulAdd(u1, key2.getPublic(), u2);
		if (p.isInfinity()) return false;
		return p.getX().umod(this.n).cmp(r2) === 0;
	}
	p = this.g.jmulAdd(u1, key2.getPublic(), u2);
	if (p.isInfinity()) return false;
	return p.eqXToP(r2);
};
EC.prototype.recoverPubKey = function (msg, signature$1, j, enc) {
	assert$5((3 & j) === j, 'The recovery param is more than two bits');
	signature$1 = new signature(signature$1, enc);
	var n = this.n;
	var e = new BN(msg);
	var r2 = signature$1.r;
	var s = signature$1.s;
	var isYOdd = j & 1;
	var isSecondKey = j >> 1;
	if (r2.cmp(this.curve.p.umod(this.curve.n)) >= 0 && isSecondKey) throw new Error('Unable to find sencond key candinate');
	if (isSecondKey) r2 = this.curve.pointFromX(r2.add(this.curve.n), isYOdd);
	else r2 = this.curve.pointFromX(r2, isYOdd);
	var rInv = signature$1.r.invm(n);
	var s1 = n.sub(e).mul(rInv).umod(n);
	var s2 = s.mul(rInv).umod(n);
	return this.g.mulAdd(s1, r2, s2);
};
EC.prototype.getKeyRecoveryParam = function (e, signature$1, Q, enc) {
	signature$1 = new signature(signature$1, enc);
	if (signature$1.recoveryParam !== null) return signature$1.recoveryParam;
	for (var i = 0; i < 4; i++) {
		var Qprime;
		try {
			Qprime = this.recoverPubKey(e, signature$1, i);
		} catch (e2) {
			continue;
		}
		if (Qprime.eq(Q)) return i;
	}
	throw new Error('Unable to find valid recovery factor');
};
var elliptic_1 = createCommonjsModule(function (module, exports) {
	var elliptic = exports;
	elliptic.version = /*RicMoo:ethers*/ { version: '6.6.1' }.version;
	elliptic.utils = utils_1$1;
	elliptic.rand =
		/*RicMoo:ethers:require(brorand)*/
		function () {
			throw new Error('unsupported');
		};
	elliptic.curve = curve_1;
	elliptic.curves = curves_1;
	elliptic.ec = ec;
	elliptic.eddsa = /*RicMoo:ethers:require(./elliptic/eddsa)*/ null;
});
var EC$1 = elliptic_1.ec;
const version$4 = 'signing-key/5.8.0';
const logger$6 = new Logger(version$4);
let _curve = null;
function getCurve() {
	if (!_curve) {
		_curve = new EC$1('secp256k1');
	}
	return _curve;
}
class SigningKey {
	constructor(privateKey) {
		defineReadOnly(this, 'curve', 'secp256k1');
		defineReadOnly(this, 'privateKey', hexlify(privateKey));
		if (hexDataLength(this.privateKey) !== 32) {
			logger$6.throwArgumentError('invalid private key', 'privateKey', '[[ REDACTED ]]');
		}
		const keyPair2 = getCurve().keyFromPrivate(arrayify(this.privateKey));
		defineReadOnly(this, 'publicKey', '0x' + keyPair2.getPublic(false, 'hex'));
		defineReadOnly(this, 'compressedPublicKey', '0x' + keyPair2.getPublic(true, 'hex'));
		defineReadOnly(this, '_isSigningKey', true);
	}
	_addPoint(other) {
		const p0 = getCurve().keyFromPublic(arrayify(this.publicKey));
		const p1 = getCurve().keyFromPublic(arrayify(other));
		return '0x' + p0.pub.add(p1.pub).encodeCompressed('hex');
	}
	signDigest(digest) {
		const keyPair2 = getCurve().keyFromPrivate(arrayify(this.privateKey));
		const digestBytes = arrayify(digest);
		if (digestBytes.length !== 32) {
			logger$6.throwArgumentError('bad digest length', 'digest', digest);
		}
		const signature2 = keyPair2.sign(digestBytes, { canonical: true });
		return splitSignature({
			recoveryParam: signature2.recoveryParam,
			r: hexZeroPad('0x' + signature2.r.toString(16), 32),
			s: hexZeroPad('0x' + signature2.s.toString(16), 32),
		});
	}
	computeSharedSecret(otherKey) {
		const keyPair2 = getCurve().keyFromPrivate(arrayify(this.privateKey));
		const otherKeyPair = getCurve().keyFromPublic(arrayify(computePublicKey(otherKey)));
		return hexZeroPad('0x' + keyPair2.derive(otherKeyPair.getPublic()).toString(16), 32);
	}
	static isSigningKey(value) {
		return !!(value && value._isSigningKey);
	}
}
function recoverPublicKey(digest, signature2) {
	const sig = splitSignature(signature2);
	const rs = { r: arrayify(sig.r), s: arrayify(sig.s) };
	return '0x' + getCurve().recoverPubKey(arrayify(digest), rs, sig.recoveryParam).encode('hex', false);
}
function computePublicKey(key2, compressed) {
	const bytes = arrayify(key2);
	if (bytes.length === 32) {
		const signingKey = new SigningKey(bytes);
		return signingKey.publicKey;
	} else if (bytes.length === 33) {
		return '0x' + getCurve().keyFromPublic(bytes).getPublic(false, 'hex');
	} else if (bytes.length === 65) {
		{
			return hexlify(bytes);
		}
	}
	return logger$6.throwArgumentError('invalid public or private key', 'key', '[REDACTED]');
}
const version$3 = 'transactions/5.8.0';
const logger$5 = new Logger(version$3);
var TransactionTypes;
(function (TransactionTypes2) {
	TransactionTypes2[(TransactionTypes2['legacy'] = 0)] = 'legacy';
	TransactionTypes2[(TransactionTypes2['eip2930'] = 1)] = 'eip2930';
	TransactionTypes2[(TransactionTypes2['eip1559'] = 2)] = 'eip1559';
})(TransactionTypes || (TransactionTypes = {}));
function handleAddress(value) {
	if (value === '0x') {
		return null;
	}
	return getAddress(value);
}
function handleNumber(value) {
	if (value === '0x') {
		return Zero$1;
	}
	return BigNumber.from(value);
}
function computeAddress(key2) {
	const publicKey = computePublicKey(key2);
	return getAddress(hexDataSlice(keccak256(hexDataSlice(publicKey, 1)), 12));
}
function recoverAddress(digest, signature2) {
	return computeAddress(recoverPublicKey(arrayify(digest), signature2));
}
function formatNumber(value, name) {
	const result = stripZeros(BigNumber.from(value).toHexString());
	if (result.length > 32) {
		logger$5.throwArgumentError('invalid length for ' + name, 'transaction:' + name, value);
	}
	return result;
}
function accessSetify(addr, storageKeys) {
	return {
		address: getAddress(addr),
		storageKeys: (storageKeys || []).map((storageKey, index) => {
			if (hexDataLength(storageKey) !== 32) {
				logger$5.throwArgumentError('invalid access list storageKey', `accessList[${addr}:${index}]`, storageKey);
			}
			return storageKey.toLowerCase();
		}),
	};
}
function accessListify(value) {
	if (Array.isArray(value)) {
		return value.map((set, index) => {
			if (Array.isArray(set)) {
				if (set.length > 2) {
					logger$5.throwArgumentError('access list expected to be [ address, storageKeys[] ]', `value[${index}]`, set);
				}
				return accessSetify(set[0], set[1]);
			}
			return accessSetify(set.address, set.storageKeys);
		});
	}
	const result = Object.keys(value).map((addr) => {
		const storageKeys = value[addr].reduce((accum, storageKey) => {
			accum[storageKey] = true;
			return accum;
		}, {});
		return accessSetify(addr, Object.keys(storageKeys).sort());
	});
	result.sort((a, b) => a.address.localeCompare(b.address));
	return result;
}
function formatAccessList(value) {
	return accessListify(value).map((set) => [set.address, set.storageKeys]);
}
function _serializeEip1559(transaction, signature2) {
	if (transaction.gasPrice != null) {
		const gasPrice = BigNumber.from(transaction.gasPrice);
		const maxFeePerGas = BigNumber.from(transaction.maxFeePerGas || 0);
		if (!gasPrice.eq(maxFeePerGas)) {
			logger$5.throwArgumentError('mismatch EIP-1559 gasPrice != maxFeePerGas', 'tx', {
				gasPrice,
				maxFeePerGas,
			});
		}
	}
	const fields = [
		formatNumber(transaction.chainId || 0, 'chainId'),
		formatNumber(transaction.nonce || 0, 'nonce'),
		formatNumber(transaction.maxPriorityFeePerGas || 0, 'maxPriorityFeePerGas'),
		formatNumber(transaction.maxFeePerGas || 0, 'maxFeePerGas'),
		formatNumber(transaction.gasLimit || 0, 'gasLimit'),
		transaction.to != null ? getAddress(transaction.to) : '0x',
		formatNumber(transaction.value || 0, 'value'),
		transaction.data || '0x',
		formatAccessList(transaction.accessList || []),
	];
	if (signature2) {
		const sig = splitSignature(signature2);
		fields.push(formatNumber(sig.recoveryParam, 'recoveryParam'));
		fields.push(stripZeros(sig.r));
		fields.push(stripZeros(sig.s));
	}
	return hexConcat(['0x02', encode(fields)]);
}
function _serializeEip2930(transaction, signature2) {
	const fields = [
		formatNumber(transaction.chainId || 0, 'chainId'),
		formatNumber(transaction.nonce || 0, 'nonce'),
		formatNumber(transaction.gasPrice || 0, 'gasPrice'),
		formatNumber(transaction.gasLimit || 0, 'gasLimit'),
		transaction.to != null ? getAddress(transaction.to) : '0x',
		formatNumber(transaction.value || 0, 'value'),
		transaction.data || '0x',
		formatAccessList(transaction.accessList || []),
	];
	if (signature2) {
		const sig = splitSignature(signature2);
		fields.push(formatNumber(sig.recoveryParam, 'recoveryParam'));
		fields.push(stripZeros(sig.r));
		fields.push(stripZeros(sig.s));
	}
	return hexConcat(['0x01', encode(fields)]);
}
function _parseEipSignature(tx, fields, serialize) {
	try {
		const recid = handleNumber(fields[0]).toNumber();
		if (recid !== 0 && recid !== 1) {
			throw new Error('bad recid');
		}
		tx.v = recid;
	} catch (error) {
		logger$5.throwArgumentError('invalid v for transaction type: 1', 'v', fields[0]);
	}
	tx.r = hexZeroPad(fields[1], 32);
	tx.s = hexZeroPad(fields[2], 32);
	try {
		const digest = keccak256(serialize(tx));
		tx.from = recoverAddress(digest, { r: tx.r, s: tx.s, recoveryParam: tx.v });
	} catch (error) {}
}
function _parseEip1559(payload) {
	const transaction = decode(payload.slice(1));
	if (transaction.length !== 9 && transaction.length !== 12) {
		logger$5.throwArgumentError('invalid component count for transaction type: 2', 'payload', hexlify(payload));
	}
	const maxPriorityFeePerGas = handleNumber(transaction[2]);
	const maxFeePerGas = handleNumber(transaction[3]);
	const tx = {
		type: 2,
		chainId: handleNumber(transaction[0]).toNumber(),
		nonce: handleNumber(transaction[1]).toNumber(),
		maxPriorityFeePerGas,
		maxFeePerGas,
		gasPrice: null,
		gasLimit: handleNumber(transaction[4]),
		to: handleAddress(transaction[5]),
		value: handleNumber(transaction[6]),
		data: transaction[7],
		accessList: accessListify(transaction[8]),
	};
	if (transaction.length === 9) {
		return tx;
	}
	tx.hash = keccak256(payload);
	_parseEipSignature(tx, transaction.slice(9), _serializeEip1559);
	return tx;
}
function _parseEip2930(payload) {
	const transaction = decode(payload.slice(1));
	if (transaction.length !== 8 && transaction.length !== 11) {
		logger$5.throwArgumentError('invalid component count for transaction type: 1', 'payload', hexlify(payload));
	}
	const tx = {
		type: 1,
		chainId: handleNumber(transaction[0]).toNumber(),
		nonce: handleNumber(transaction[1]).toNumber(),
		gasPrice: handleNumber(transaction[2]),
		gasLimit: handleNumber(transaction[3]),
		to: handleAddress(transaction[4]),
		value: handleNumber(transaction[5]),
		data: transaction[6],
		accessList: accessListify(transaction[7]),
	};
	if (transaction.length === 8) {
		return tx;
	}
	tx.hash = keccak256(payload);
	_parseEipSignature(tx, transaction.slice(8), _serializeEip2930);
	return tx;
}
function _parse(rawTransaction) {
	const transaction = decode(rawTransaction);
	if (transaction.length !== 9 && transaction.length !== 6) {
		logger$5.throwArgumentError('invalid raw transaction', 'rawTransaction', rawTransaction);
	}
	const tx = {
		nonce: handleNumber(transaction[0]).toNumber(),
		gasPrice: handleNumber(transaction[1]),
		gasLimit: handleNumber(transaction[2]),
		to: handleAddress(transaction[3]),
		value: handleNumber(transaction[4]),
		data: transaction[5],
		chainId: 0,
	};
	if (transaction.length === 6) {
		return tx;
	}
	try {
		tx.v = BigNumber.from(transaction[6]).toNumber();
	} catch (error) {
		return tx;
	}
	tx.r = hexZeroPad(transaction[7], 32);
	tx.s = hexZeroPad(transaction[8], 32);
	if (BigNumber.from(tx.r).isZero() && BigNumber.from(tx.s).isZero()) {
		tx.chainId = tx.v;
		tx.v = 0;
	} else {
		tx.chainId = Math.floor((tx.v - 35) / 2);
		if (tx.chainId < 0) {
			tx.chainId = 0;
		}
		let recoveryParam = tx.v - 27;
		const raw = transaction.slice(0, 6);
		if (tx.chainId !== 0) {
			raw.push(hexlify(tx.chainId));
			raw.push('0x');
			raw.push('0x');
			recoveryParam -= tx.chainId * 2 + 8;
		}
		const digest = keccak256(encode(raw));
		try {
			tx.from = recoverAddress(digest, { r: hexlify(tx.r), s: hexlify(tx.s), recoveryParam });
		} catch (error) {}
		tx.hash = keccak256(rawTransaction);
	}
	tx.type = null;
	return tx;
}
function parse(rawTransaction) {
	const payload = arrayify(rawTransaction);
	if (payload[0] > 127) {
		return _parse(payload);
	}
	switch (payload[0]) {
		case 1:
			return _parseEip2930(payload);
		case 2:
			return _parseEip1559(payload);
	}
	return logger$5.throwError(`unsupported transaction type: ${payload[0]}`, Logger.errors.UNSUPPORTED_OPERATION, {
		operation: 'parseTransaction',
		transactionType: payload[0],
	});
}
const version$2 = 'networks/5.8.0';
const logger$4 = new Logger(version$2);
function isRenetworkable(value) {
	return value && typeof value.renetwork === 'function';
}
function ethDefaultProvider(network) {
	const func = function (providers, options) {
		if (options == null) {
			options = {};
		}
		const providerList = [];
		if (providers.InfuraProvider && options.infura !== '-') {
			try {
				providerList.push(new providers.InfuraProvider(network, options.infura));
			} catch (error) {}
		}
		if (providers.EtherscanProvider && options.etherscan !== '-') {
			try {
				providerList.push(new providers.EtherscanProvider(network, options.etherscan));
			} catch (error) {}
		}
		if (providers.AlchemyProvider && options.alchemy !== '-') {
			try {
				providerList.push(new providers.AlchemyProvider(network, options.alchemy));
			} catch (error) {}
		}
		if (providers.PocketProvider && options.pocket !== '-') {
			const skip = ['goerli', 'ropsten', 'rinkeby', 'sepolia'];
			try {
				const provider = new providers.PocketProvider(network, options.pocket);
				if (provider.network && skip.indexOf(provider.network.name) === -1) {
					providerList.push(provider);
				}
			} catch (error) {}
		}
		if (providers.CloudflareProvider && options.cloudflare !== '-') {
			try {
				providerList.push(new providers.CloudflareProvider(network));
			} catch (error) {}
		}
		if (providers.AnkrProvider && options.ankr !== '-') {
			try {
				const skip = ['ropsten'];
				const provider = new providers.AnkrProvider(network, options.ankr);
				if (provider.network && skip.indexOf(provider.network.name) === -1) {
					providerList.push(provider);
				}
			} catch (error) {}
		}
		if (providers.QuickNodeProvider && options.quicknode !== '-') {
			try {
				providerList.push(new providers.QuickNodeProvider(network, options.quicknode));
			} catch (error) {}
		}
		if (providerList.length === 0) {
			return null;
		}
		if (providers.FallbackProvider) {
			let quorum = 1;
			if (options.quorum != null) {
				quorum = options.quorum;
			} else if (network === 'homestead') {
				quorum = 2;
			}
			return new providers.FallbackProvider(providerList, quorum);
		}
		return providerList[0];
	};
	func.renetwork = function (network2) {
		return ethDefaultProvider(network2);
	};
	return func;
}
function etcDefaultProvider(url, network) {
	const func = function (providers, options) {
		if (providers.JsonRpcProvider) {
			return new providers.JsonRpcProvider(url, network);
		}
		return null;
	};
	func.renetwork = function (network2) {
		return etcDefaultProvider(url, network2);
	};
	return func;
}
const homestead = {
	chainId: 1,
	ensAddress: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e',
	name: 'homestead',
	_defaultProvider: ethDefaultProvider('homestead'),
};
const ropsten = {
	chainId: 3,
	ensAddress: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e',
	name: 'ropsten',
	_defaultProvider: ethDefaultProvider('ropsten'),
};
const classicMordor = {
	chainId: 63,
	name: 'classicMordor',
	_defaultProvider: etcDefaultProvider('https://www.ethercluster.com/mordor', 'classicMordor'),
};
const networks = {
	unspecified: { chainId: 0, name: 'unspecified' },
	homestead,
	mainnet: homestead,
	morden: { chainId: 2, name: 'morden' },
	ropsten,
	testnet: ropsten,
	rinkeby: {
		chainId: 4,
		ensAddress: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e',
		name: 'rinkeby',
		_defaultProvider: ethDefaultProvider('rinkeby'),
	},
	kovan: {
		chainId: 42,
		name: 'kovan',
		_defaultProvider: ethDefaultProvider('kovan'),
	},
	goerli: {
		chainId: 5,
		ensAddress: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e',
		name: 'goerli',
		_defaultProvider: ethDefaultProvider('goerli'),
	},
	kintsugi: { chainId: 1337702, name: 'kintsugi' },
	sepolia: {
		chainId: 11155111,
		ensAddress: '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e',
		name: 'sepolia',
		_defaultProvider: ethDefaultProvider('sepolia'),
	},
	holesky: {
		chainId: 17e3,
		name: 'holesky',
		_defaultProvider: ethDefaultProvider('holesky'),
	},
	// ETC (See: #351)
	classic: {
		chainId: 61,
		name: 'classic',
		_defaultProvider: etcDefaultProvider('https://www.ethercluster.com/etc', 'classic'),
	},
	classicMorden: { chainId: 62, name: 'classicMorden' },
	classicMordor,
	classicTestnet: classicMordor,
	classicKotti: {
		chainId: 6,
		name: 'classicKotti',
		_defaultProvider: etcDefaultProvider('https://www.ethercluster.com/kotti', 'classicKotti'),
	},
	xdai: { chainId: 100, name: 'xdai' },
	matic: {
		chainId: 137,
		name: 'matic',
		_defaultProvider: ethDefaultProvider('matic'),
	},
	maticmum: {
		chainId: 80001,
		name: 'maticmum',
		_defaultProvider: ethDefaultProvider('maticmum'),
	},
	optimism: {
		chainId: 10,
		name: 'optimism',
		_defaultProvider: ethDefaultProvider('optimism'),
	},
	'optimism-kovan': { chainId: 69, name: 'optimism-kovan' },
	'optimism-goerli': { chainId: 420, name: 'optimism-goerli' },
	'optimism-sepolia': { chainId: 11155420, name: 'optimism-sepolia' },
	arbitrum: { chainId: 42161, name: 'arbitrum' },
	'arbitrum-rinkeby': { chainId: 421611, name: 'arbitrum-rinkeby' },
	'arbitrum-goerli': { chainId: 421613, name: 'arbitrum-goerli' },
	'arbitrum-sepolia': { chainId: 421614, name: 'arbitrum-sepolia' },
	bnb: { chainId: 56, name: 'bnb' },
	bnbt: { chainId: 97, name: 'bnbt' },
};
function getNetwork(network) {
	if (network == null) {
		return null;
	}
	if (typeof network === 'number') {
		for (const name in networks) {
			const standard2 = networks[name];
			if (standard2.chainId === network) {
				return {
					name: standard2.name,
					chainId: standard2.chainId,
					ensAddress: standard2.ensAddress || null,
					_defaultProvider: standard2._defaultProvider || null,
				};
			}
		}
		return {
			chainId: network,
			name: 'unknown',
		};
	}
	if (typeof network === 'string') {
		const standard2 = networks[network];
		if (standard2 == null) {
			return null;
		}
		return {
			name: standard2.name,
			chainId: standard2.chainId,
			ensAddress: standard2.ensAddress,
			_defaultProvider: standard2._defaultProvider || null,
		};
	}
	const standard = networks[network.name];
	if (!standard) {
		if (typeof network.chainId !== 'number') {
			logger$4.throwArgumentError('invalid network chainId', 'network', network);
		}
		return network;
	}
	if (network.chainId !== 0 && network.chainId !== standard.chainId) {
		logger$4.throwArgumentError('network chainId mismatch', 'network', network);
	}
	let defaultProvider = network._defaultProvider || null;
	if (defaultProvider == null && standard._defaultProvider) {
		if (isRenetworkable(standard._defaultProvider)) {
			defaultProvider = standard._defaultProvider.renetwork(network);
		} else {
			defaultProvider = standard._defaultProvider;
		}
	}
	return {
		name: network.name,
		chainId: standard.chainId,
		ensAddress: network.ensAddress || standard.ensAddress || null,
		_defaultProvider: defaultProvider,
	};
}
const version$1 = 'web/5.8.0';
var __awaiter$3 = function (thisArg, _arguments, P, generator) {
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
function getUrl(href, options) {
	return __awaiter$3(this, void 0, void 0, function* () {
		if (options == null) {
			options = {};
		}
		const request = {
			method: options.method || 'GET',
			headers: options.headers || {},
			body: options.body || void 0,
		};
		if (options.skipFetchSetup !== true) {
			request.mode = 'cors';
			request.cache = 'no-cache';
			request.credentials = 'same-origin';
			request.redirect = 'follow';
			request.referrer = 'client';
		}
		if (options.fetchOptions != null) {
			const opts = options.fetchOptions;
			if (opts.mode) {
				request.mode = opts.mode;
			}
			if (opts.cache) {
				request.cache = opts.cache;
			}
			if (opts.credentials) {
				request.credentials = opts.credentials;
			}
			if (opts.redirect) {
				request.redirect = opts.redirect;
			}
			if (opts.referrer) {
				request.referrer = opts.referrer;
			}
		}
		const response = yield fetch(href, request);
		const body = yield response.arrayBuffer();
		const headers = {};
		if (response.headers.forEach) {
			response.headers.forEach((value, key2) => {
				headers[key2.toLowerCase()] = value;
			});
		} else {
			response.headers.keys().forEach((key2) => {
				headers[key2.toLowerCase()] = response.headers.get(key2);
			});
		}
		return {
			headers,
			statusCode: response.status,
			statusMessage: response.statusText,
			body: arrayify(new Uint8Array(body)),
		};
	});
}
var __awaiter$2 = function (thisArg, _arguments, P, generator) {
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
const logger$3 = new Logger(version$1);
function staller(duration) {
	return new Promise((resolve) => {
		setTimeout(resolve, duration);
	});
}
function bodyify(value, type) {
	if (value == null) {
		return null;
	}
	if (typeof value === 'string') {
		return value;
	}
	if (isBytesLike(value)) {
		if (type && (type.split('/')[0] === 'text' || type.split(';')[0].trim() === 'application/json')) {
			try {
				return toUtf8String(value);
			} catch (error) {}
		}
		return hexlify(value);
	}
	return value;
}
function unpercent(value) {
	return toUtf8Bytes(
		value.replace(/%([0-9a-f][0-9a-f])/gi, (all, code) => {
			return String.fromCharCode(parseInt(code, 16));
		}),
	);
}
function _fetchData(connection, body, processFunc) {
	const attemptLimit = typeof connection === 'object' && connection.throttleLimit != null ? connection.throttleLimit : 12;
	logger$3.assertArgument(
		attemptLimit > 0 && attemptLimit % 1 === 0,
		'invalid connection throttle limit',
		'connection.throttleLimit',
		attemptLimit,
	);
	const throttleCallback = typeof connection === 'object' ? connection.throttleCallback : null;
	const throttleSlotInterval =
		typeof connection === 'object' && typeof connection.throttleSlotInterval === 'number' ? connection.throttleSlotInterval : 100;
	logger$3.assertArgument(
		throttleSlotInterval > 0 && throttleSlotInterval % 1 === 0,
		'invalid connection throttle slot interval',
		'connection.throttleSlotInterval',
		throttleSlotInterval,
	);
	const errorPassThrough = typeof connection === 'object' ? !!connection.errorPassThrough : false;
	const headers = {};
	let url = null;
	const options = {
		method: 'GET',
	};
	let allow304 = false;
	let timeout = 2 * 60 * 1e3;
	if (typeof connection === 'string') {
		url = connection;
	} else if (typeof connection === 'object') {
		if (connection == null || connection.url == null) {
			logger$3.throwArgumentError('missing URL', 'connection.url', connection);
		}
		url = connection.url;
		if (typeof connection.timeout === 'number' && connection.timeout > 0) {
			timeout = connection.timeout;
		}
		if (connection.headers) {
			for (const key2 in connection.headers) {
				headers[key2.toLowerCase()] = { key: key2, value: String(connection.headers[key2]) };
				if (['if-none-match', 'if-modified-since'].indexOf(key2.toLowerCase()) >= 0) {
					allow304 = true;
				}
			}
		}
		options.allowGzip = !!connection.allowGzip;
		if (connection.user != null && connection.password != null) {
			if (url.substring(0, 6) !== 'https:' && connection.allowInsecureAuthentication !== true) {
				logger$3.throwError('basic authentication requires a secure https url', Logger.errors.INVALID_ARGUMENT, {
					argument: 'url',
					url,
					user: connection.user,
					password: '[REDACTED]',
				});
			}
			const authorization = connection.user + ':' + connection.password;
			headers['authorization'] = {
				key: 'Authorization',
				value: 'Basic ' + encode$1(toUtf8Bytes(authorization)),
			};
		}
		if (connection.skipFetchSetup != null) {
			options.skipFetchSetup = !!connection.skipFetchSetup;
		}
		if (connection.fetchOptions != null) {
			options.fetchOptions = shallowCopy(connection.fetchOptions);
		}
	}
	const reData = new RegExp('^data:([^;:]*)?(;base64)?,(.*)$', 'i');
	const dataMatch = url ? url.match(reData) : null;
	if (dataMatch) {
		try {
			const response = {
				statusCode: 200,
				statusMessage: 'OK',
				headers: { 'content-type': dataMatch[1] || 'text/plain' },
				body: dataMatch[2] ? decode$1(dataMatch[3]) : unpercent(dataMatch[3]),
			};
			let result = response.body;
			if (processFunc) {
				result = processFunc(response.body, response);
			}
			return Promise.resolve(result);
		} catch (error) {
			logger$3.throwError('processing response error', Logger.errors.SERVER_ERROR, {
				body: bodyify(dataMatch[1], dataMatch[2]),
				error,
				requestBody: null,
				requestMethod: 'GET',
				url,
			});
		}
	}
	if (body) {
		options.method = 'POST';
		options.body = body;
		if (headers['content-type'] == null) {
			headers['content-type'] = { key: 'Content-Type', value: 'application/octet-stream' };
		}
		if (headers['content-length'] == null) {
			headers['content-length'] = { key: 'Content-Length', value: String(body.length) };
		}
	}
	const flatHeaders = {};
	Object.keys(headers).forEach((key2) => {
		const header = headers[key2];
		flatHeaders[header.key] = header.value;
	});
	options.headers = flatHeaders;
	const runningTimeout = (function () {
		let timer2 = null;
		const promise = new Promise(function (resolve, reject) {
			if (timeout) {
				timer2 = setTimeout(() => {
					if (timer2 == null) {
						return;
					}
					timer2 = null;
					reject(
						logger$3.makeError('timeout', Logger.errors.TIMEOUT, {
							requestBody: bodyify(options.body, flatHeaders['content-type']),
							requestMethod: options.method,
							timeout,
							url,
						}),
					);
				}, timeout);
			}
		});
		const cancel = function () {
			if (timer2 == null) {
				return;
			}
			clearTimeout(timer2);
			timer2 = null;
		};
		return { promise, cancel };
	})();
	const runningFetch = (function () {
		return __awaiter$2(this, void 0, void 0, function* () {
			for (let attempt = 0; attempt < attemptLimit; attempt++) {
				let response = null;
				try {
					response = yield getUrl(url, options);
					if (attempt < attemptLimit) {
						if (response.statusCode === 301 || response.statusCode === 302) {
							const location = response.headers.location || '';
							if (options.method === 'GET' && location.match(/^https:/)) {
								url = response.headers.location;
								continue;
							}
						} else if (response.statusCode === 429) {
							let tryAgain = true;
							if (throttleCallback) {
								tryAgain = yield throttleCallback(attempt, url);
							}
							if (tryAgain) {
								let stall2 = 0;
								const retryAfter = response.headers['retry-after'];
								if (typeof retryAfter === 'string' && retryAfter.match(/^[1-9][0-9]*$/)) {
									stall2 = parseInt(retryAfter) * 1e3;
								} else {
									stall2 = throttleSlotInterval * parseInt(String(Math.random() * Math.pow(2, attempt)));
								}
								yield staller(stall2);
								continue;
							}
						}
					}
				} catch (error) {
					response = error.response;
					if (response == null) {
						runningTimeout.cancel();
						logger$3.throwError('missing response', Logger.errors.SERVER_ERROR, {
							requestBody: bodyify(options.body, flatHeaders['content-type']),
							requestMethod: options.method,
							serverError: error,
							url,
						});
					}
				}
				let body2 = response.body;
				if (allow304 && response.statusCode === 304) {
					body2 = null;
				} else if (!errorPassThrough && (response.statusCode < 200 || response.statusCode >= 300)) {
					runningTimeout.cancel();
					logger$3.throwError('bad response', Logger.errors.SERVER_ERROR, {
						status: response.statusCode,
						headers: response.headers,
						body: bodyify(body2, response.headers ? response.headers['content-type'] : null),
						requestBody: bodyify(options.body, flatHeaders['content-type']),
						requestMethod: options.method,
						url,
					});
				}
				if (processFunc) {
					try {
						const result = yield processFunc(body2, response);
						runningTimeout.cancel();
						return result;
					} catch (error) {
						if (error.throttleRetry && attempt < attemptLimit) {
							let tryAgain = true;
							if (throttleCallback) {
								tryAgain = yield throttleCallback(attempt, url);
							}
							if (tryAgain) {
								const timeout2 = throttleSlotInterval * parseInt(String(Math.random() * Math.pow(2, attempt)));
								yield staller(timeout2);
								continue;
							}
						}
						runningTimeout.cancel();
						logger$3.throwError('processing response error', Logger.errors.SERVER_ERROR, {
							body: bodyify(body2, response.headers ? response.headers['content-type'] : null),
							error,
							requestBody: bodyify(options.body, flatHeaders['content-type']),
							requestMethod: options.method,
							url,
						});
					}
				}
				runningTimeout.cancel();
				return body2;
			}
			return logger$3.throwError('failed response', Logger.errors.SERVER_ERROR, {
				requestBody: bodyify(options.body, flatHeaders['content-type']),
				requestMethod: options.method,
				url,
			});
		});
	})();
	return Promise.race([runningTimeout.promise, runningFetch]);
}
function fetchJson(connection, json, processFunc) {
	let processJsonFunc = (value, response) => {
		let result = null;
		if (value != null) {
			try {
				result = JSON.parse(toUtf8String(value));
			} catch (error) {
				logger$3.throwError('invalid JSON', Logger.errors.SERVER_ERROR, {
					body: value,
					error,
				});
			}
		}
		if (processFunc) {
			result = processFunc(result, response);
		}
		return result;
	};
	let body = null;
	if (json != null) {
		body = toUtf8Bytes(json);
		const updated = typeof connection === 'string' ? { url: connection } : shallowCopy(connection);
		if (updated.headers) {
			const hasContentType = Object.keys(updated.headers).filter((k) => k.toLowerCase() === 'content-type').length !== 0;
			if (!hasContentType) {
				updated.headers = shallowCopy(updated.headers);
				updated.headers['content-type'] = 'application/json';
			}
		} else {
			updated.headers = { 'content-type': 'application/json' };
		}
		connection = updated;
	}
	return _fetchData(connection, body, processJsonFunc);
}
function poll(func, options) {
	if (!options) {
		options = {};
	}
	options = shallowCopy(options);
	if (options.floor == null) {
		options.floor = 0;
	}
	if (options.ceiling == null) {
		options.ceiling = 1e4;
	}
	if (options.interval == null) {
		options.interval = 250;
	}
	return new Promise(function (resolve, reject) {
		let timer2 = null;
		let done = false;
		const cancel = () => {
			if (done) {
				return false;
			}
			done = true;
			if (timer2) {
				clearTimeout(timer2);
			}
			return true;
		};
		if (options.timeout) {
			timer2 = setTimeout(() => {
				if (cancel()) {
					reject(new Error('timeout'));
				}
			}, options.timeout);
		}
		const retryLimit = options.retryLimit;
		let attempt = 0;
		function check() {
			return func().then(
				function (result) {
					if (result !== void 0) {
						if (cancel()) {
							resolve(result);
						}
					} else if (options.oncePoll) {
						options.oncePoll.once('poll', check);
					} else if (options.onceBlock) {
						options.onceBlock.once('block', check);
					} else if (!done) {
						attempt++;
						if (attempt > retryLimit) {
							if (cancel()) {
								reject(new Error('retry limit reached'));
							}
							return;
						}
						let timeout = options.interval * parseInt(String(Math.random() * Math.pow(2, attempt)));
						if (timeout < options.floor) {
							timeout = options.floor;
						}
						if (timeout > options.ceiling) {
							timeout = options.ceiling;
						}
						setTimeout(check, timeout);
					}
					return null;
				},
				function (error) {
					if (cancel()) {
						reject(error);
					}
				},
			);
		}
		check();
	});
}
var bech32$1;
var hasRequiredBech32;
function requireBech32() {
	if (hasRequiredBech32) return bech32$1;
	hasRequiredBech32 = 1;
	var ALPHABET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
	var ALPHABET_MAP = {};
	for (var z = 0; z < ALPHABET.length; z++) {
		var x = ALPHABET.charAt(z);
		if (ALPHABET_MAP[x] !== void 0) throw new TypeError(x + ' is ambiguous');
		ALPHABET_MAP[x] = z;
	}
	function polymodStep(pre) {
		var b = pre >> 25;
		return (
			((pre & 33554431) << 5) ^
			(-((b >> 0) & 1) & 996825010) ^
			(-((b >> 1) & 1) & 642813549) ^
			(-((b >> 2) & 1) & 513874426) ^
			(-((b >> 3) & 1) & 1027748829) ^
			(-((b >> 4) & 1) & 705979059)
		);
	}
	function prefixChk(prefix) {
		var chk = 1;
		for (var i = 0; i < prefix.length; ++i) {
			var c = prefix.charCodeAt(i);
			if (c < 33 || c > 126) return 'Invalid prefix (' + prefix + ')';
			chk = polymodStep(chk) ^ (c >> 5);
		}
		chk = polymodStep(chk);
		for (i = 0; i < prefix.length; ++i) {
			var v = prefix.charCodeAt(i);
			chk = polymodStep(chk) ^ (v & 31);
		}
		return chk;
	}
	function encode3(prefix, words, LIMIT) {
		LIMIT = LIMIT || 90;
		if (prefix.length + 7 + words.length > LIMIT) throw new TypeError('Exceeds length limit');
		prefix = prefix.toLowerCase();
		var chk = prefixChk(prefix);
		if (typeof chk === 'string') throw new Error(chk);
		var result = prefix + '1';
		for (var i = 0; i < words.length; ++i) {
			var x2 = words[i];
			if (x2 >> 5 !== 0) throw new Error('Non 5-bit word');
			chk = polymodStep(chk) ^ x2;
			result += ALPHABET.charAt(x2);
		}
		for (i = 0; i < 6; ++i) {
			chk = polymodStep(chk);
		}
		chk ^= 1;
		for (i = 0; i < 6; ++i) {
			var v = (chk >> ((5 - i) * 5)) & 31;
			result += ALPHABET.charAt(v);
		}
		return result;
	}
	function __decode(str, LIMIT) {
		LIMIT = LIMIT || 90;
		if (str.length < 8) return str + ' too short';
		if (str.length > LIMIT) return 'Exceeds length limit';
		var lowered = str.toLowerCase();
		var uppered = str.toUpperCase();
		if (str !== lowered && str !== uppered) return 'Mixed-case string ' + str;
		str = lowered;
		var split = str.lastIndexOf('1');
		if (split === -1) return 'No separator character for ' + str;
		if (split === 0) return 'Missing prefix for ' + str;
		var prefix = str.slice(0, split);
		var wordChars = str.slice(split + 1);
		if (wordChars.length < 6) return 'Data too short';
		var chk = prefixChk(prefix);
		if (typeof chk === 'string') return chk;
		var words = [];
		for (var i = 0; i < wordChars.length; ++i) {
			var c = wordChars.charAt(i);
			var v = ALPHABET_MAP[c];
			if (v === void 0) return 'Unknown character ' + c;
			chk = polymodStep(chk) ^ v;
			if (i + 6 >= wordChars.length) continue;
			words.push(v);
		}
		if (chk !== 1) return 'Invalid checksum for ' + str;
		return { prefix, words };
	}
	function decodeUnsafe() {
		var res = __decode.apply(null, arguments);
		if (typeof res === 'object') return res;
	}
	function decode2(str) {
		var res = __decode.apply(null, arguments);
		if (typeof res === 'object') return res;
		throw new Error(res);
	}
	function convert(data, inBits, outBits, pad) {
		var value = 0;
		var bits = 0;
		var maxV = (1 << outBits) - 1;
		var result = [];
		for (var i = 0; i < data.length; ++i) {
			value = (value << inBits) | data[i];
			bits += inBits;
			while (bits >= outBits) {
				bits -= outBits;
				result.push((value >> bits) & maxV);
			}
		}
		if (pad) {
			if (bits > 0) {
				result.push((value << (outBits - bits)) & maxV);
			}
		} else {
			if (bits >= inBits) return 'Excess padding';
			if ((value << (outBits - bits)) & maxV) return 'Non-zero padding';
		}
		return result;
	}
	function toWordsUnsafe(bytes) {
		var res = convert(bytes, 8, 5, true);
		if (Array.isArray(res)) return res;
	}
	function toWords(bytes) {
		var res = convert(bytes, 8, 5, true);
		if (Array.isArray(res)) return res;
		throw new Error(res);
	}
	function fromWordsUnsafe(words) {
		var res = convert(words, 5, 8, false);
		if (Array.isArray(res)) return res;
	}
	function fromWords(words) {
		var res = convert(words, 5, 8, false);
		if (Array.isArray(res)) return res;
		throw new Error(res);
	}
	bech32$1 = {
		decodeUnsafe,
		decode: decode2,
		encode: encode3,
		toWordsUnsafe,
		toWords,
		fromWordsUnsafe,
		fromWords,
	};
	return bech32$1;
}
var bech32Exports = requireBech32();
const bech32 = /* @__PURE__ */ getDefaultExportFromCjs(bech32Exports);
const version = 'providers/5.8.0';
const logger$2 = new Logger(version);
class Formatter {
	constructor() {
		this.formats = this.getDefaultFormats();
	}
	getDefaultFormats() {
		const formats = {};
		const address = this.address.bind(this);
		const bigNumber = this.bigNumber.bind(this);
		const blockTag = this.blockTag.bind(this);
		const data = this.data.bind(this);
		const hash2 = this.hash.bind(this);
		const hex = this.hex.bind(this);
		const number = this.number.bind(this);
		const type = this.type.bind(this);
		const strictData = (v) => {
			return this.data(v, true);
		};
		formats.transaction = {
			hash: hash2,
			type,
			accessList: Formatter.allowNull(this.accessList.bind(this), null),
			blockHash: Formatter.allowNull(hash2, null),
			blockNumber: Formatter.allowNull(number, null),
			transactionIndex: Formatter.allowNull(number, null),
			confirmations: Formatter.allowNull(number, null),
			from: address,
			// either (gasPrice) or (maxPriorityFeePerGas + maxFeePerGas)
			// must be set
			gasPrice: Formatter.allowNull(bigNumber),
			maxPriorityFeePerGas: Formatter.allowNull(bigNumber),
			maxFeePerGas: Formatter.allowNull(bigNumber),
			gasLimit: bigNumber,
			to: Formatter.allowNull(address, null),
			value: bigNumber,
			nonce: number,
			data,
			r: Formatter.allowNull(this.uint256),
			s: Formatter.allowNull(this.uint256),
			v: Formatter.allowNull(number),
			creates: Formatter.allowNull(address, null),
			raw: Formatter.allowNull(data),
		};
		formats.transactionRequest = {
			from: Formatter.allowNull(address),
			nonce: Formatter.allowNull(number),
			gasLimit: Formatter.allowNull(bigNumber),
			gasPrice: Formatter.allowNull(bigNumber),
			maxPriorityFeePerGas: Formatter.allowNull(bigNumber),
			maxFeePerGas: Formatter.allowNull(bigNumber),
			to: Formatter.allowNull(address),
			value: Formatter.allowNull(bigNumber),
			data: Formatter.allowNull(strictData),
			type: Formatter.allowNull(number),
			accessList: Formatter.allowNull(this.accessList.bind(this), null),
		};
		formats.receiptLog = {
			transactionIndex: number,
			blockNumber: number,
			transactionHash: hash2,
			address,
			topics: Formatter.arrayOf(hash2),
			data,
			logIndex: number,
			blockHash: hash2,
		};
		formats.receipt = {
			to: Formatter.allowNull(this.address, null),
			from: Formatter.allowNull(this.address, null),
			contractAddress: Formatter.allowNull(address, null),
			transactionIndex: number,
			// should be allowNull(hash), but broken-EIP-658 support is handled in receipt
			root: Formatter.allowNull(hex),
			gasUsed: bigNumber,
			logsBloom: Formatter.allowNull(data),
			blockHash: hash2,
			transactionHash: hash2,
			logs: Formatter.arrayOf(this.receiptLog.bind(this)),
			blockNumber: number,
			confirmations: Formatter.allowNull(number, null),
			cumulativeGasUsed: bigNumber,
			effectiveGasPrice: Formatter.allowNull(bigNumber),
			status: Formatter.allowNull(number),
			type,
		};
		formats.block = {
			hash: Formatter.allowNull(hash2),
			parentHash: hash2,
			number,
			timestamp: number,
			nonce: Formatter.allowNull(hex),
			difficulty: this.difficulty.bind(this),
			gasLimit: bigNumber,
			gasUsed: bigNumber,
			miner: Formatter.allowNull(address),
			extraData: data,
			transactions: Formatter.allowNull(Formatter.arrayOf(hash2)),
			baseFeePerGas: Formatter.allowNull(bigNumber),
		};
		formats.blockWithTransactions = shallowCopy(formats.block);
		formats.blockWithTransactions.transactions = Formatter.allowNull(Formatter.arrayOf(this.transactionResponse.bind(this)));
		formats.filter = {
			fromBlock: Formatter.allowNull(blockTag, void 0),
			toBlock: Formatter.allowNull(blockTag, void 0),
			blockHash: Formatter.allowNull(hash2, void 0),
			address: Formatter.allowNull(address, void 0),
			topics: Formatter.allowNull(this.topics.bind(this), void 0),
		};
		formats.filterLog = {
			blockNumber: Formatter.allowNull(number),
			blockHash: Formatter.allowNull(hash2),
			transactionIndex: number,
			removed: Formatter.allowNull(this.boolean.bind(this)),
			address,
			data: Formatter.allowFalsish(data, '0x'),
			topics: Formatter.arrayOf(hash2),
			transactionHash: hash2,
			logIndex: number,
		};
		return formats;
	}
	accessList(accessList) {
		return accessListify(accessList || []);
	}
	// Requires a BigNumberish that is within the IEEE754 safe integer range; returns a number
	// Strict! Used on input.
	number(number) {
		if (number === '0x') {
			return 0;
		}
		return BigNumber.from(number).toNumber();
	}
	type(number) {
		if (number === '0x' || number == null) {
			return 0;
		}
		return BigNumber.from(number).toNumber();
	}
	// Strict! Used on input.
	bigNumber(value) {
		return BigNumber.from(value);
	}
	// Requires a boolean, "true" or  "false"; returns a boolean
	boolean(value) {
		if (typeof value === 'boolean') {
			return value;
		}
		if (typeof value === 'string') {
			value = value.toLowerCase();
			if (value === 'true') {
				return true;
			}
			if (value === 'false') {
				return false;
			}
		}
		throw new Error('invalid boolean - ' + value);
	}
	hex(value, strict) {
		if (typeof value === 'string') {
			if (!strict && value.substring(0, 2) !== '0x') {
				value = '0x' + value;
			}
			if (isHexString(value)) {
				return value.toLowerCase();
			}
		}
		return logger$2.throwArgumentError('invalid hash', 'value', value);
	}
	data(value, strict) {
		const result = this.hex(value, strict);
		if (result.length % 2 !== 0) {
			throw new Error('invalid data; odd-length - ' + value);
		}
		return result;
	}
	// Requires an address
	// Strict! Used on input.
	address(value) {
		return getAddress(value);
	}
	callAddress(value) {
		if (!isHexString(value, 32)) {
			return null;
		}
		const address = getAddress(hexDataSlice(value, 12));
		return address === AddressZero ? null : address;
	}
	contractAddress(value) {
		return getContractAddress(value);
	}
	// Strict! Used on input.
	blockTag(blockTag) {
		if (blockTag == null) {
			return 'latest';
		}
		if (blockTag === 'earliest') {
			return '0x0';
		}
		switch (blockTag) {
			case 'earliest':
				return '0x0';
			case 'latest':
			case 'pending':
			case 'safe':
			case 'finalized':
				return blockTag;
		}
		if (typeof blockTag === 'number' || isHexString(blockTag)) {
			return hexValue(blockTag);
		}
		throw new Error('invalid blockTag');
	}
	// Requires a hash, optionally requires 0x prefix; returns prefixed lowercase hash.
	hash(value, strict) {
		const result = this.hex(value, strict);
		if (hexDataLength(result) !== 32) {
			return logger$2.throwArgumentError('invalid hash', 'value', value);
		}
		return result;
	}
	// Returns the difficulty as a number, or if too large (i.e. PoA network) null
	difficulty(value) {
		if (value == null) {
			return null;
		}
		const v = BigNumber.from(value);
		try {
			return v.toNumber();
		} catch (error) {}
		return null;
	}
	uint256(value) {
		if (!isHexString(value)) {
			throw new Error('invalid uint256');
		}
		return hexZeroPad(value, 32);
	}
	_block(value, format) {
		if (value.author != null && value.miner == null) {
			value.miner = value.author;
		}
		const difficulty = value._difficulty != null ? value._difficulty : value.difficulty;
		const result = Formatter.check(format, value);
		result._difficulty = difficulty == null ? null : BigNumber.from(difficulty);
		return result;
	}
	block(value) {
		return this._block(value, this.formats.block);
	}
	blockWithTransactions(value) {
		return this._block(value, this.formats.blockWithTransactions);
	}
	// Strict! Used on input.
	transactionRequest(value) {
		return Formatter.check(this.formats.transactionRequest, value);
	}
	transactionResponse(transaction) {
		if (transaction.gas != null && transaction.gasLimit == null) {
			transaction.gasLimit = transaction.gas;
		}
		if (transaction.to && BigNumber.from(transaction.to).isZero()) {
			transaction.to = '0x0000000000000000000000000000000000000000';
		}
		if (transaction.input != null && transaction.data == null) {
			transaction.data = transaction.input;
		}
		if (transaction.to == null && transaction.creates == null) {
			transaction.creates = this.contractAddress(transaction);
		}
		if ((transaction.type === 1 || transaction.type === 2) && transaction.accessList == null) {
			transaction.accessList = [];
		}
		const result = Formatter.check(this.formats.transaction, transaction);
		if (transaction.chainId != null) {
			let chainId = transaction.chainId;
			if (isHexString(chainId)) {
				chainId = BigNumber.from(chainId).toNumber();
			}
			result.chainId = chainId;
		} else {
			let chainId = transaction.networkId;
			if (chainId == null && result.v == null) {
				chainId = transaction.chainId;
			}
			if (isHexString(chainId)) {
				chainId = BigNumber.from(chainId).toNumber();
			}
			if (typeof chainId !== 'number' && result.v != null) {
				chainId = (result.v - 35) / 2;
				if (chainId < 0) {
					chainId = 0;
				}
				chainId = parseInt(chainId);
			}
			if (typeof chainId !== 'number') {
				chainId = 0;
			}
			result.chainId = chainId;
		}
		if (result.blockHash && result.blockHash.replace(/0/g, '') === 'x') {
			result.blockHash = null;
		}
		return result;
	}
	transaction(value) {
		return parse(value);
	}
	receiptLog(value) {
		return Formatter.check(this.formats.receiptLog, value);
	}
	receipt(value) {
		const result = Formatter.check(this.formats.receipt, value);
		if (result.root != null) {
			if (result.root.length <= 4) {
				const value2 = BigNumber.from(result.root).toNumber();
				if (value2 === 0 || value2 === 1) {
					if (result.status != null && result.status !== value2) {
						logger$2.throwArgumentError('alt-root-status/status mismatch', 'value', { root: result.root, status: result.status });
					}
					result.status = value2;
					delete result.root;
				} else {
					logger$2.throwArgumentError('invalid alt-root-status', 'value.root', result.root);
				}
			} else if (result.root.length !== 66) {
				logger$2.throwArgumentError('invalid root hash', 'value.root', result.root);
			}
		}
		if (result.status != null) {
			result.byzantium = true;
		}
		return result;
	}
	topics(value) {
		if (Array.isArray(value)) {
			return value.map((v) => this.topics(v));
		} else if (value != null) {
			return this.hash(value, true);
		}
		return null;
	}
	filter(value) {
		return Formatter.check(this.formats.filter, value);
	}
	filterLog(value) {
		return Formatter.check(this.formats.filterLog, value);
	}
	static check(format, object) {
		const result = {};
		for (const key2 in format) {
			try {
				const value = format[key2](object[key2]);
				if (value !== void 0) {
					result[key2] = value;
				}
			} catch (error) {
				error.checkKey = key2;
				error.checkValue = object[key2];
				throw error;
			}
		}
		return result;
	}
	// if value is null-ish, nullValue is returned
	static allowNull(format, nullValue) {
		return function (value) {
			if (value == null) {
				return nullValue;
			}
			return format(value);
		};
	}
	// If value is false-ish, replaceValue is returned
	static allowFalsish(format, replaceValue) {
		return function (value) {
			if (!value) {
				return replaceValue;
			}
			return format(value);
		};
	}
	// Requires an Array satisfying check
	static arrayOf(format) {
		return function (array) {
			if (!Array.isArray(array)) {
				throw new Error('not an array');
			}
			const result = [];
			array.forEach(function (value) {
				result.push(format(value));
			});
			return result;
		};
	}
}
var __awaiter$1 = function (thisArg, _arguments, P, generator) {
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
const logger$1 = new Logger(version);
const MAX_CCIP_REDIRECTS = 10;
function checkTopic(topic) {
	if (topic == null) {
		return 'null';
	}
	if (hexDataLength(topic) !== 32) {
		logger$1.throwArgumentError('invalid topic', 'topic', topic);
	}
	return topic.toLowerCase();
}
function serializeTopics(topics) {
	topics = topics.slice();
	while (topics.length > 0 && topics[topics.length - 1] == null) {
		topics.pop();
	}
	return topics
		.map((topic) => {
			if (Array.isArray(topic)) {
				const unique = {};
				topic.forEach((topic2) => {
					unique[checkTopic(topic2)] = true;
				});
				const sorted = Object.keys(unique);
				sorted.sort();
				return sorted.join('|');
			} else {
				return checkTopic(topic);
			}
		})
		.join('&');
}
function deserializeTopics(data) {
	if (data === '') {
		return [];
	}
	return data.split(/&/g).map((topic) => {
		if (topic === '') {
			return [];
		}
		const comps = topic.split('|').map((topic2) => {
			return topic2 === 'null' ? null : topic2;
		});
		return comps.length === 1 ? comps[0] : comps;
	});
}
function getEventTag(eventName) {
	if (typeof eventName === 'string') {
		eventName = eventName.toLowerCase();
		if (hexDataLength(eventName) === 32) {
			return 'tx:' + eventName;
		}
		if (eventName.indexOf(':') === -1) {
			return eventName;
		}
	} else if (Array.isArray(eventName)) {
		return 'filter:*:' + serializeTopics(eventName);
	} else if (ForkEvent.isForkEvent(eventName)) {
		logger$1.warn('not implemented');
		throw new Error('not implemented');
	} else if (eventName && typeof eventName === 'object') {
		return 'filter:' + (eventName.address || '*') + ':' + serializeTopics(eventName.topics || []);
	}
	throw new Error('invalid event - ' + eventName);
}
function getTime() {
	return /* @__PURE__ */ new Date().getTime();
}
function stall(duration) {
	return new Promise((resolve) => {
		setTimeout(resolve, duration);
	});
}
const PollableEvents = ['block', 'network', 'pending', 'poll'];
class Event {
	constructor(tag, listener, once) {
		defineReadOnly(this, 'tag', tag);
		defineReadOnly(this, 'listener', listener);
		defineReadOnly(this, 'once', once);
		this._lastBlockNumber = -2;
		this._inflight = false;
	}
	get event() {
		switch (this.type) {
			case 'tx':
				return this.hash;
			case 'filter':
				return this.filter;
		}
		return this.tag;
	}
	get type() {
		return this.tag.split(':')[0];
	}
	get hash() {
		const comps = this.tag.split(':');
		if (comps[0] !== 'tx') {
			return null;
		}
		return comps[1];
	}
	get filter() {
		const comps = this.tag.split(':');
		if (comps[0] !== 'filter') {
			return null;
		}
		const address = comps[1];
		const topics = deserializeTopics(comps[2]);
		const filter = {};
		if (topics.length > 0) {
			filter.topics = topics;
		}
		if (address && address !== '*') {
			filter.address = address;
		}
		return filter;
	}
	pollable() {
		return this.tag.indexOf(':') >= 0 || PollableEvents.indexOf(this.tag) >= 0;
	}
}
const coinInfos = {
	0: { symbol: 'btc', p2pkh: 0, p2sh: 5, prefix: 'bc' },
	2: { symbol: 'ltc', p2pkh: 48, p2sh: 50, prefix: 'ltc' },
	3: { symbol: 'doge', p2pkh: 30, p2sh: 22 },
	60: { symbol: 'eth', ilk: 'eth' },
	61: { symbol: 'etc', ilk: 'eth' },
	700: { symbol: 'xdai', ilk: 'eth' },
};
function bytes32ify(value) {
	return hexZeroPad(BigNumber.from(value).toHexString(), 32);
}
function base58Encode(data) {
	return Base58.encode(concat([data, hexDataSlice(sha256(sha256(data)), 0, 4)]));
}
const matcherIpfs = new RegExp('^(ipfs)://(.*)$', 'i');
const matchers = [
	new RegExp('^(https)://(.*)$', 'i'),
	new RegExp('^(data):(.*)$', 'i'),
	matcherIpfs,
	new RegExp('^eip155:[0-9]+/(erc[0-9]+):(.*)$', 'i'),
];
function _parseString(result, start) {
	try {
		return toUtf8String(_parseBytes(result, start));
	} catch (error) {}
	return null;
}
function _parseBytes(result, start) {
	if (result === '0x') {
		return null;
	}
	const offset = BigNumber.from(hexDataSlice(result, start, start + 32)).toNumber();
	const length = BigNumber.from(hexDataSlice(result, offset, offset + 32)).toNumber();
	return hexDataSlice(result, offset + 32, offset + 32 + length);
}
function getIpfsLink(link) {
	if (link.match(/^ipfs:\/\/ipfs\//i)) {
		link = link.substring(12);
	} else if (link.match(/^ipfs:\/\//i)) {
		link = link.substring(7);
	} else {
		logger$1.throwArgumentError('unsupported IPFS format', 'link', link);
	}
	return `https://gateway.ipfs.io/ipfs/${link}`;
}
function numPad(value) {
	const result = arrayify(value);
	if (result.length > 32) {
		throw new Error('internal; should not happen');
	}
	const padded = new Uint8Array(32);
	padded.set(result, 32 - result.length);
	return padded;
}
function bytesPad(value) {
	if (value.length % 32 === 0) {
		return value;
	}
	const result = new Uint8Array(Math.ceil(value.length / 32) * 32);
	result.set(value);
	return result;
}
function encodeBytes(datas) {
	const result = [];
	let byteCount = 0;
	for (let i = 0; i < datas.length; i++) {
		result.push(null);
		byteCount += 32;
	}
	for (let i = 0; i < datas.length; i++) {
		const data = arrayify(datas[i]);
		result[i] = numPad(byteCount);
		result.push(numPad(data.length));
		result.push(bytesPad(data));
		byteCount += 32 + Math.ceil(data.length / 32) * 32;
	}
	return hexConcat(result);
}
class Resolver {
	// The resolvedAddress is only for creating a ReverseLookup resolver
	constructor(provider, address, name, resolvedAddress) {
		defineReadOnly(this, 'provider', provider);
		defineReadOnly(this, 'name', name);
		defineReadOnly(this, 'address', provider.formatter.address(address));
		defineReadOnly(this, '_resolvedAddress', resolvedAddress);
	}
	supportsWildcard() {
		if (!this._supportsEip2544) {
			this._supportsEip2544 = this.provider
				.call({
					to: this.address,
					data: '0x01ffc9a79061b92300000000000000000000000000000000000000000000000000000000',
				})
				.then((result) => {
					return BigNumber.from(result).eq(1);
				})
				.catch((error) => {
					if (error.code === Logger.errors.CALL_EXCEPTION) {
						return false;
					}
					this._supportsEip2544 = null;
					throw error;
				});
		}
		return this._supportsEip2544;
	}
	_fetch(selector, parameters) {
		return __awaiter$1(this, void 0, void 0, function* () {
			const tx = {
				to: this.address,
				ccipReadEnabled: true,
				data: hexConcat([selector, namehash(this.name), parameters || '0x']),
			};
			let parseBytes = false;
			if (yield this.supportsWildcard()) {
				parseBytes = true;
				tx.data = hexConcat(['0x9061b923', encodeBytes([dnsEncode(this.name), tx.data])]);
			}
			try {
				let result = yield this.provider.call(tx);
				if (arrayify(result).length % 32 === 4) {
					logger$1.throwError('resolver threw error', Logger.errors.CALL_EXCEPTION, {
						transaction: tx,
						data: result,
					});
				}
				if (parseBytes) {
					result = _parseBytes(result, 0);
				}
				return result;
			} catch (error) {
				if (error.code === Logger.errors.CALL_EXCEPTION) {
					return null;
				}
				throw error;
			}
		});
	}
	_fetchBytes(selector, parameters) {
		return __awaiter$1(this, void 0, void 0, function* () {
			const result = yield this._fetch(selector, parameters);
			if (result != null) {
				return _parseBytes(result, 0);
			}
			return null;
		});
	}
	_getAddress(coinType, hexBytes) {
		const coinInfo = coinInfos[String(coinType)];
		if (coinInfo == null) {
			logger$1.throwError(`unsupported coin type: ${coinType}`, Logger.errors.UNSUPPORTED_OPERATION, {
				operation: `getAddress(${coinType})`,
			});
		}
		if (coinInfo.ilk === 'eth') {
			return this.provider.formatter.address(hexBytes);
		}
		const bytes = arrayify(hexBytes);
		if (coinInfo.p2pkh != null) {
			const p2pkh = hexBytes.match(/^0x76a9([0-9a-f][0-9a-f])([0-9a-f]*)88ac$/);
			if (p2pkh) {
				const length = parseInt(p2pkh[1], 16);
				if (p2pkh[2].length === length * 2 && length >= 1 && length <= 75) {
					return base58Encode(concat([[coinInfo.p2pkh], '0x' + p2pkh[2]]));
				}
			}
		}
		if (coinInfo.p2sh != null) {
			const p2sh = hexBytes.match(/^0xa9([0-9a-f][0-9a-f])([0-9a-f]*)87$/);
			if (p2sh) {
				const length = parseInt(p2sh[1], 16);
				if (p2sh[2].length === length * 2 && length >= 1 && length <= 75) {
					return base58Encode(concat([[coinInfo.p2sh], '0x' + p2sh[2]]));
				}
			}
		}
		if (coinInfo.prefix != null) {
			const length = bytes[1];
			let version2 = bytes[0];
			if (version2 === 0) {
				if (length !== 20 && length !== 32) {
					version2 = -1;
				}
			} else {
				version2 = -1;
			}
			if (version2 >= 0 && bytes.length === 2 + length && length >= 1 && length <= 75) {
				const words = bech32.toWords(bytes.slice(2));
				words.unshift(version2);
				return bech32.encode(coinInfo.prefix, words);
			}
		}
		return null;
	}
	getAddress(coinType) {
		return __awaiter$1(this, void 0, void 0, function* () {
			if (coinType == null) {
				coinType = 60;
			}
			if (coinType === 60) {
				try {
					const result = yield this._fetch('0x3b3b57de');
					if (result === '0x' || result === HashZero) {
						return null;
					}
					return this.provider.formatter.callAddress(result);
				} catch (error) {
					if (error.code === Logger.errors.CALL_EXCEPTION) {
						return null;
					}
					throw error;
				}
			}
			const hexBytes = yield this._fetchBytes('0xf1cb7e06', bytes32ify(coinType));
			if (hexBytes == null || hexBytes === '0x') {
				return null;
			}
			const address = this._getAddress(coinType, hexBytes);
			if (address == null) {
				logger$1.throwError(`invalid or unsupported coin data`, Logger.errors.UNSUPPORTED_OPERATION, {
					operation: `getAddress(${coinType})`,
					coinType,
					data: hexBytes,
				});
			}
			return address;
		});
	}
	getAvatar() {
		return __awaiter$1(this, void 0, void 0, function* () {
			const linkage = [{ type: 'name', content: this.name }];
			try {
				const avatar = yield this.getText('avatar');
				if (avatar == null) {
					return null;
				}
				for (let i = 0; i < matchers.length; i++) {
					const match = avatar.match(matchers[i]);
					if (match == null) {
						continue;
					}
					const scheme = match[1].toLowerCase();
					switch (scheme) {
						case 'https':
							linkage.push({ type: 'url', content: avatar });
							return { linkage, url: avatar };
						case 'data':
							linkage.push({ type: 'data', content: avatar });
							return { linkage, url: avatar };
						case 'ipfs':
							linkage.push({ type: 'ipfs', content: avatar });
							return { linkage, url: getIpfsLink(avatar) };
						case 'erc721':
						case 'erc1155': {
							const selector = scheme === 'erc721' ? '0xc87b56dd' : '0x0e89341c';
							linkage.push({ type: scheme, content: avatar });
							const owner = this._resolvedAddress || (yield this.getAddress());
							const comps = (match[2] || '').split('/');
							if (comps.length !== 2) {
								return null;
							}
							const addr = yield this.provider.formatter.address(comps[0]);
							const tokenId = hexZeroPad(BigNumber.from(comps[1]).toHexString(), 32);
							if (scheme === 'erc721') {
								const tokenOwner = this.provider.formatter.callAddress(
									yield this.provider.call({
										to: addr,
										data: hexConcat(['0x6352211e', tokenId]),
									}),
								);
								if (owner !== tokenOwner) {
									return null;
								}
								linkage.push({ type: 'owner', content: tokenOwner });
							} else if (scheme === 'erc1155') {
								const balance = BigNumber.from(
									yield this.provider.call({
										to: addr,
										data: hexConcat(['0x00fdd58e', hexZeroPad(owner, 32), tokenId]),
									}),
								);
								if (balance.isZero()) {
									return null;
								}
								linkage.push({ type: 'balance', content: balance.toString() });
							}
							const tx = {
								to: this.provider.formatter.address(comps[0]),
								data: hexConcat([selector, tokenId]),
							};
							let metadataUrl = _parseString(yield this.provider.call(tx), 0);
							if (metadataUrl == null) {
								return null;
							}
							linkage.push({ type: 'metadata-url-base', content: metadataUrl });
							if (scheme === 'erc1155') {
								metadataUrl = metadataUrl.replace('{id}', tokenId.substring(2));
								linkage.push({ type: 'metadata-url-expanded', content: metadataUrl });
							}
							if (metadataUrl.match(/^ipfs:/i)) {
								metadataUrl = getIpfsLink(metadataUrl);
							}
							linkage.push({ type: 'metadata-url', content: metadataUrl });
							const metadata = yield fetchJson(metadataUrl);
							if (!metadata) {
								return null;
							}
							linkage.push({ type: 'metadata', content: JSON.stringify(metadata) });
							let imageUrl = metadata.image;
							if (typeof imageUrl !== 'string') {
								return null;
							}
							if (imageUrl.match(/^(https:\/\/|data:)/i)) {
							} else {
								const ipfs = imageUrl.match(matcherIpfs);
								if (ipfs == null) {
									return null;
								}
								linkage.push({ type: 'url-ipfs', content: imageUrl });
								imageUrl = getIpfsLink(imageUrl);
							}
							linkage.push({ type: 'url', content: imageUrl });
							return { linkage, url: imageUrl };
						}
					}
				}
			} catch (error) {}
			return null;
		});
	}
	getContentHash() {
		return __awaiter$1(this, void 0, void 0, function* () {
			const hexBytes = yield this._fetchBytes('0xbc1c58d1');
			if (hexBytes == null || hexBytes === '0x') {
				return null;
			}
			const ipfs = hexBytes.match(/^0xe3010170(([0-9a-f][0-9a-f])([0-9a-f][0-9a-f])([0-9a-f]*))$/);
			if (ipfs) {
				const length = parseInt(ipfs[3], 16);
				if (ipfs[4].length === length * 2) {
					return 'ipfs://' + Base58.encode('0x' + ipfs[1]);
				}
			}
			const ipns = hexBytes.match(/^0xe5010172(([0-9a-f][0-9a-f])([0-9a-f][0-9a-f])([0-9a-f]*))$/);
			if (ipns) {
				const length = parseInt(ipns[3], 16);
				if (ipns[4].length === length * 2) {
					return 'ipns://' + Base58.encode('0x' + ipns[1]);
				}
			}
			const swarm = hexBytes.match(/^0xe40101fa011b20([0-9a-f]*)$/);
			if (swarm) {
				if (swarm[1].length === 32 * 2) {
					return 'bzz://' + swarm[1];
				}
			}
			const skynet = hexBytes.match(/^0x90b2c605([0-9a-f]*)$/);
			if (skynet) {
				if (skynet[1].length === 34 * 2) {
					const urlSafe = { '=': '', '+': '-', '/': '_' };
					const hash2 = encode$1('0x' + skynet[1]).replace(/[=+\/]/g, (a) => urlSafe[a]);
					return 'sia://' + hash2;
				}
			}
			return logger$1.throwError(`invalid or unsupported content hash data`, Logger.errors.UNSUPPORTED_OPERATION, {
				operation: 'getContentHash()',
				data: hexBytes,
			});
		});
	}
	getText(key2) {
		return __awaiter$1(this, void 0, void 0, function* () {
			let keyBytes = toUtf8Bytes(key2);
			keyBytes = concat([bytes32ify(64), bytes32ify(keyBytes.length), keyBytes]);
			if (keyBytes.length % 32 !== 0) {
				keyBytes = concat([keyBytes, hexZeroPad('0x', 32 - (key2.length % 32))]);
			}
			const hexBytes = yield this._fetchBytes('0x59d1d43c', hexlify(keyBytes));
			if (hexBytes == null || hexBytes === '0x') {
				return null;
			}
			return toUtf8String(hexBytes);
		});
	}
}
let defaultFormatter = null;
let nextPollId = 1;
class BaseProvider extends Provider {
	/**
	 *  ready
	 *
	 *  A Promise<Network> that resolves only once the provider is ready.
	 *
	 *  Sub-classes that call the super with a network without a chainId
	 *  MUST set this. Standard named networks have a known chainId.
	 *
	 */
	constructor(network) {
		super();
		this._events = [];
		this._emitted = { block: -2 };
		this.disableCcipRead = false;
		this.formatter = new.target.getFormatter();
		defineReadOnly(this, 'anyNetwork', network === 'any');
		if (this.anyNetwork) {
			network = this.detectNetwork();
		}
		if (network instanceof Promise) {
			this._networkPromise = network;
			network.catch((error) => {});
			this._ready().catch((error) => {});
		} else {
			const knownNetwork = getStatic(new.target, 'getNetwork')(network);
			if (knownNetwork) {
				defineReadOnly(this, '_network', knownNetwork);
				this.emit('network', knownNetwork, null);
			} else {
				logger$1.throwArgumentError('invalid network', 'network', network);
			}
		}
		this._maxInternalBlockNumber = -1024;
		this._lastBlockNumber = -2;
		this._maxFilterBlockRange = 10;
		this._pollingInterval = 4e3;
		this._fastQueryDate = 0;
	}
	_ready() {
		return __awaiter$1(this, void 0, void 0, function* () {
			if (this._network == null) {
				let network = null;
				if (this._networkPromise) {
					try {
						network = yield this._networkPromise;
					} catch (error) {}
				}
				if (network == null) {
					network = yield this.detectNetwork();
				}
				if (!network) {
					logger$1.throwError('no network detected', Logger.errors.UNKNOWN_ERROR, {});
				}
				if (this._network == null) {
					if (this.anyNetwork) {
						this._network = network;
					} else {
						defineReadOnly(this, '_network', network);
					}
					this.emit('network', network, null);
				}
			}
			return this._network;
		});
	}
	// This will always return the most recently established network.
	// For "any", this can change (a "network" event is emitted before
	// any change is reflected); otherwise this cannot change
	get ready() {
		return poll(() => {
			return this._ready().then(
				(network) => {
					return network;
				},
				(error) => {
					if (error.code === Logger.errors.NETWORK_ERROR && error.event === 'noNetwork') {
						return void 0;
					}
					throw error;
				},
			);
		});
	}
	// @TODO: Remove this and just create a singleton formatter
	static getFormatter() {
		if (defaultFormatter == null) {
			defaultFormatter = new Formatter();
		}
		return defaultFormatter;
	}
	// @TODO: Remove this and just use getNetwork
	static getNetwork(network) {
		return getNetwork(network == null ? 'homestead' : network);
	}
	ccipReadFetch(tx, calldata, urls) {
		return __awaiter$1(this, void 0, void 0, function* () {
			if (this.disableCcipRead || urls.length === 0) {
				return null;
			}
			const sender = tx.to.toLowerCase();
			const data = calldata.toLowerCase();
			const errorMessages = [];
			for (let i = 0; i < urls.length; i++) {
				const url = urls[i];
				const href = url.replace('{sender}', sender).replace('{data}', data);
				const json = url.indexOf('{data}') >= 0 ? null : JSON.stringify({ data, sender });
				const result = yield fetchJson({ url: href, errorPassThrough: true }, json, (value, response) => {
					value.status = response.statusCode;
					return value;
				});
				if (result.data) {
					return result.data;
				}
				const errorMessage = result.message || 'unknown error';
				if (result.status >= 400 && result.status < 500) {
					return logger$1.throwError(`response not found during CCIP fetch: ${errorMessage}`, Logger.errors.SERVER_ERROR, {
						url,
						errorMessage,
					});
				}
				errorMessages.push(errorMessage);
			}
			return logger$1.throwError(
				`error encountered during CCIP fetch: ${errorMessages.map((m) => JSON.stringify(m)).join(', ')}`,
				Logger.errors.SERVER_ERROR,
				{
					urls,
					errorMessages,
				},
			);
		});
	}
	// Fetches the blockNumber, but will reuse any result that is less
	// than maxAge old or has been requested since the last request
	_getInternalBlockNumber(maxAge) {
		return __awaiter$1(this, void 0, void 0, function* () {
			yield this._ready();
			if (maxAge > 0) {
				while (this._internalBlockNumber) {
					const internalBlockNumber = this._internalBlockNumber;
					try {
						const result = yield internalBlockNumber;
						if (getTime() - result.respTime <= maxAge) {
							return result.blockNumber;
						}
						break;
					} catch (error) {
						if (this._internalBlockNumber === internalBlockNumber) {
							break;
						}
					}
				}
			}
			const reqTime = getTime();
			const checkInternalBlockNumber = resolveProperties({
				blockNumber: this.perform('getBlockNumber', {}),
				networkError: this.getNetwork().then(
					(network) => null,
					(error) => error,
				),
			}).then(({ blockNumber, networkError }) => {
				if (networkError) {
					if (this._internalBlockNumber === checkInternalBlockNumber) {
						this._internalBlockNumber = null;
					}
					throw networkError;
				}
				const respTime = getTime();
				blockNumber = BigNumber.from(blockNumber).toNumber();
				if (blockNumber < this._maxInternalBlockNumber) {
					blockNumber = this._maxInternalBlockNumber;
				}
				this._maxInternalBlockNumber = blockNumber;
				this._setFastBlockNumber(blockNumber);
				return { blockNumber, reqTime, respTime };
			});
			this._internalBlockNumber = checkInternalBlockNumber;
			checkInternalBlockNumber.catch((error) => {
				if (this._internalBlockNumber === checkInternalBlockNumber) {
					this._internalBlockNumber = null;
				}
			});
			return (yield checkInternalBlockNumber).blockNumber;
		});
	}
	poll() {
		return __awaiter$1(this, void 0, void 0, function* () {
			const pollId = nextPollId++;
			const runners = [];
			let blockNumber = null;
			try {
				blockNumber = yield this._getInternalBlockNumber(100 + this.pollingInterval / 2);
			} catch (error) {
				this.emit('error', error);
				return;
			}
			this._setFastBlockNumber(blockNumber);
			this.emit('poll', pollId, blockNumber);
			if (blockNumber === this._lastBlockNumber) {
				this.emit('didPoll', pollId);
				return;
			}
			if (this._emitted.block === -2) {
				this._emitted.block = blockNumber - 1;
			}
			if (Math.abs(this._emitted.block - blockNumber) > 1e3) {
				logger$1.warn(`network block skew detected; skipping block events (emitted=${this._emitted.block} blockNumber${blockNumber})`);
				this.emit(
					'error',
					logger$1.makeError('network block skew detected', Logger.errors.NETWORK_ERROR, {
						blockNumber,
						event: 'blockSkew',
						previousBlockNumber: this._emitted.block,
					}),
				);
				this.emit('block', blockNumber);
			} else {
				for (let i = this._emitted.block + 1; i <= blockNumber; i++) {
					this.emit('block', i);
				}
			}
			if (this._emitted.block !== blockNumber) {
				this._emitted.block = blockNumber;
				Object.keys(this._emitted).forEach((key2) => {
					if (key2 === 'block') {
						return;
					}
					const eventBlockNumber = this._emitted[key2];
					if (eventBlockNumber === 'pending') {
						return;
					}
					if (blockNumber - eventBlockNumber > 12) {
						delete this._emitted[key2];
					}
				});
			}
			if (this._lastBlockNumber === -2) {
				this._lastBlockNumber = blockNumber - 1;
			}
			this._events.forEach((event) => {
				switch (event.type) {
					case 'tx': {
						const hash2 = event.hash;
						let runner = this.getTransactionReceipt(hash2)
							.then((receipt) => {
								if (!receipt || receipt.blockNumber == null) {
									return null;
								}
								this._emitted['t:' + hash2] = receipt.blockNumber;
								this.emit(hash2, receipt);
								return null;
							})
							.catch((error) => {
								this.emit('error', error);
							});
						runners.push(runner);
						break;
					}
					case 'filter': {
						if (!event._inflight) {
							event._inflight = true;
							if (event._lastBlockNumber === -2) {
								event._lastBlockNumber = blockNumber - 1;
							}
							const filter = event.filter;
							filter.fromBlock = event._lastBlockNumber + 1;
							filter.toBlock = blockNumber;
							const minFromBlock = filter.toBlock - this._maxFilterBlockRange;
							if (minFromBlock > filter.fromBlock) {
								filter.fromBlock = minFromBlock;
							}
							if (filter.fromBlock < 0) {
								filter.fromBlock = 0;
							}
							const runner = this.getLogs(filter)
								.then((logs) => {
									event._inflight = false;
									if (logs.length === 0) {
										return;
									}
									logs.forEach((log) => {
										if (log.blockNumber > event._lastBlockNumber) {
											event._lastBlockNumber = log.blockNumber;
										}
										this._emitted['b:' + log.blockHash] = log.blockNumber;
										this._emitted['t:' + log.transactionHash] = log.blockNumber;
										this.emit(filter, log);
									});
								})
								.catch((error) => {
									this.emit('error', error);
									event._inflight = false;
								});
							runners.push(runner);
						}
						break;
					}
				}
			});
			this._lastBlockNumber = blockNumber;
			Promise.all(runners)
				.then(() => {
					this.emit('didPoll', pollId);
				})
				.catch((error) => {
					this.emit('error', error);
				});
			return;
		});
	}
	// Deprecated; do not use this
	resetEventsBlock(blockNumber) {
		this._lastBlockNumber = blockNumber - 1;
		if (this.polling) {
			this.poll();
		}
	}
	get network() {
		return this._network;
	}
	// This method should query the network if the underlying network
	// can change, such as when connected to a JSON-RPC backend
	detectNetwork() {
		return __awaiter$1(this, void 0, void 0, function* () {
			return logger$1.throwError('provider does not support network detection', Logger.errors.UNSUPPORTED_OPERATION, {
				operation: 'provider.detectNetwork',
			});
		});
	}
	getNetwork() {
		return __awaiter$1(this, void 0, void 0, function* () {
			const network = yield this._ready();
			const currentNetwork = yield this.detectNetwork();
			if (network.chainId !== currentNetwork.chainId) {
				if (this.anyNetwork) {
					this._network = currentNetwork;
					this._lastBlockNumber = -2;
					this._fastBlockNumber = null;
					this._fastBlockNumberPromise = null;
					this._fastQueryDate = 0;
					this._emitted.block = -2;
					this._maxInternalBlockNumber = -1024;
					this._internalBlockNumber = null;
					this.emit('network', currentNetwork, network);
					yield stall(0);
					return this._network;
				}
				const error = logger$1.makeError('underlying network changed', Logger.errors.NETWORK_ERROR, {
					event: 'changed',
					network,
					detectedNetwork: currentNetwork,
				});
				this.emit('error', error);
				throw error;
			}
			return network;
		});
	}
	get blockNumber() {
		this._getInternalBlockNumber(100 + this.pollingInterval / 2).then(
			(blockNumber) => {
				this._setFastBlockNumber(blockNumber);
			},
			(error) => {},
		);
		return this._fastBlockNumber != null ? this._fastBlockNumber : -1;
	}
	get polling() {
		return this._poller != null;
	}
	set polling(value) {
		if (value && !this._poller) {
			this._poller = setInterval(() => {
				this.poll();
			}, this.pollingInterval);
			if (!this._bootstrapPoll) {
				this._bootstrapPoll = setTimeout(() => {
					this.poll();
					this._bootstrapPoll = setTimeout(() => {
						if (!this._poller) {
							this.poll();
						}
						this._bootstrapPoll = null;
					}, this.pollingInterval);
				}, 0);
			}
		} else if (!value && this._poller) {
			clearInterval(this._poller);
			this._poller = null;
		}
	}
	get pollingInterval() {
		return this._pollingInterval;
	}
	set pollingInterval(value) {
		if (typeof value !== 'number' || value <= 0 || parseInt(String(value)) != value) {
			throw new Error('invalid polling interval');
		}
		this._pollingInterval = value;
		if (this._poller) {
			clearInterval(this._poller);
			this._poller = setInterval(() => {
				this.poll();
			}, this._pollingInterval);
		}
	}
	_getFastBlockNumber() {
		const now = getTime();
		if (now - this._fastQueryDate > 2 * this._pollingInterval) {
			this._fastQueryDate = now;
			this._fastBlockNumberPromise = this.getBlockNumber().then((blockNumber) => {
				if (this._fastBlockNumber == null || blockNumber > this._fastBlockNumber) {
					this._fastBlockNumber = blockNumber;
				}
				return this._fastBlockNumber;
			});
		}
		return this._fastBlockNumberPromise;
	}
	_setFastBlockNumber(blockNumber) {
		if (this._fastBlockNumber != null && blockNumber < this._fastBlockNumber) {
			return;
		}
		this._fastQueryDate = getTime();
		if (this._fastBlockNumber == null || blockNumber > this._fastBlockNumber) {
			this._fastBlockNumber = blockNumber;
			this._fastBlockNumberPromise = Promise.resolve(blockNumber);
		}
	}
	waitForTransaction(transactionHash, confirmations, timeout) {
		return __awaiter$1(this, void 0, void 0, function* () {
			return this._waitForTransaction(transactionHash, confirmations == null ? 1 : confirmations, timeout || 0, null);
		});
	}
	_waitForTransaction(transactionHash, confirmations, timeout, replaceable) {
		return __awaiter$1(this, void 0, void 0, function* () {
			const receipt = yield this.getTransactionReceipt(transactionHash);
			if ((receipt ? receipt.confirmations : 0) >= confirmations) {
				return receipt;
			}
			return new Promise((resolve, reject) => {
				const cancelFuncs = [];
				let done = false;
				const alreadyDone = function () {
					if (done) {
						return true;
					}
					done = true;
					cancelFuncs.forEach((func) => {
						func();
					});
					return false;
				};
				const minedHandler = (receipt2) => {
					if (receipt2.confirmations < confirmations) {
						return;
					}
					if (alreadyDone()) {
						return;
					}
					resolve(receipt2);
				};
				this.on(transactionHash, minedHandler);
				cancelFuncs.push(() => {
					this.removeListener(transactionHash, minedHandler);
				});
				if (replaceable) {
					let lastBlockNumber = replaceable.startBlock;
					let scannedBlock = null;
					const replaceHandler = (blockNumber) =>
						__awaiter$1(this, void 0, void 0, function* () {
							if (done) {
								return;
							}
							yield stall(1e3);
							this.getTransactionCount(replaceable.from).then(
								(nonce) =>
									__awaiter$1(this, void 0, void 0, function* () {
										if (done) {
											return;
										}
										if (nonce <= replaceable.nonce) {
											lastBlockNumber = blockNumber;
										} else {
											{
												const mined = yield this.getTransaction(transactionHash);
												if (mined && mined.blockNumber != null) {
													return;
												}
											}
											if (scannedBlock == null) {
												scannedBlock = lastBlockNumber - 3;
												if (scannedBlock < replaceable.startBlock) {
													scannedBlock = replaceable.startBlock;
												}
											}
											while (scannedBlock <= blockNumber) {
												if (done) {
													return;
												}
												const block = yield this.getBlockWithTransactions(scannedBlock);
												for (let ti = 0; ti < block.transactions.length; ti++) {
													const tx = block.transactions[ti];
													if (tx.hash === transactionHash) {
														return;
													}
													if (tx.from === replaceable.from && tx.nonce === replaceable.nonce) {
														if (done) {
															return;
														}
														const receipt2 = yield this.waitForTransaction(tx.hash, confirmations);
														if (alreadyDone()) {
															return;
														}
														let reason = 'replaced';
														if (tx.data === replaceable.data && tx.to === replaceable.to && tx.value.eq(replaceable.value)) {
															reason = 'repriced';
														} else if (tx.data === '0x' && tx.from === tx.to && tx.value.isZero()) {
															reason = 'cancelled';
														}
														reject(
															logger$1.makeError('transaction was replaced', Logger.errors.TRANSACTION_REPLACED, {
																cancelled: reason === 'replaced' || reason === 'cancelled',
																reason,
																replacement: this._wrapTransaction(tx),
																hash: transactionHash,
																receipt: receipt2,
															}),
														);
														return;
													}
												}
												scannedBlock++;
											}
										}
										if (done) {
											return;
										}
										this.once('block', replaceHandler);
									}),
								(error) => {
									if (done) {
										return;
									}
									this.once('block', replaceHandler);
								},
							);
						});
					if (done) {
						return;
					}
					this.once('block', replaceHandler);
					cancelFuncs.push(() => {
						this.removeListener('block', replaceHandler);
					});
				}
				if (typeof timeout === 'number' && timeout > 0) {
					const timer2 = setTimeout(() => {
						if (alreadyDone()) {
							return;
						}
						reject(logger$1.makeError('timeout exceeded', Logger.errors.TIMEOUT, { timeout }));
					}, timeout);
					if (timer2.unref) {
						timer2.unref();
					}
					cancelFuncs.push(() => {
						clearTimeout(timer2);
					});
				}
			});
		});
	}
	getBlockNumber() {
		return __awaiter$1(this, void 0, void 0, function* () {
			return this._getInternalBlockNumber(0);
		});
	}
	getGasPrice() {
		return __awaiter$1(this, void 0, void 0, function* () {
			yield this.getNetwork();
			const result = yield this.perform('getGasPrice', {});
			try {
				return BigNumber.from(result);
			} catch (error) {
				return logger$1.throwError('bad result from backend', Logger.errors.SERVER_ERROR, {
					method: 'getGasPrice',
					result,
					error,
				});
			}
		});
	}
	getBalance(addressOrName, blockTag) {
		return __awaiter$1(this, void 0, void 0, function* () {
			yield this.getNetwork();
			const params = yield resolveProperties({
				address: this._getAddress(addressOrName),
				blockTag: this._getBlockTag(blockTag),
			});
			const result = yield this.perform('getBalance', params);
			try {
				return BigNumber.from(result);
			} catch (error) {
				return logger$1.throwError('bad result from backend', Logger.errors.SERVER_ERROR, {
					method: 'getBalance',
					params,
					result,
					error,
				});
			}
		});
	}
	getTransactionCount(addressOrName, blockTag) {
		return __awaiter$1(this, void 0, void 0, function* () {
			yield this.getNetwork();
			const params = yield resolveProperties({
				address: this._getAddress(addressOrName),
				blockTag: this._getBlockTag(blockTag),
			});
			const result = yield this.perform('getTransactionCount', params);
			try {
				return BigNumber.from(result).toNumber();
			} catch (error) {
				return logger$1.throwError('bad result from backend', Logger.errors.SERVER_ERROR, {
					method: 'getTransactionCount',
					params,
					result,
					error,
				});
			}
		});
	}
	getCode(addressOrName, blockTag) {
		return __awaiter$1(this, void 0, void 0, function* () {
			yield this.getNetwork();
			const params = yield resolveProperties({
				address: this._getAddress(addressOrName),
				blockTag: this._getBlockTag(blockTag),
			});
			const result = yield this.perform('getCode', params);
			try {
				return hexlify(result);
			} catch (error) {
				return logger$1.throwError('bad result from backend', Logger.errors.SERVER_ERROR, {
					method: 'getCode',
					params,
					result,
					error,
				});
			}
		});
	}
	getStorageAt(addressOrName, position, blockTag) {
		return __awaiter$1(this, void 0, void 0, function* () {
			yield this.getNetwork();
			const params = yield resolveProperties({
				address: this._getAddress(addressOrName),
				blockTag: this._getBlockTag(blockTag),
				position: Promise.resolve(position).then((p) => hexValue(p)),
			});
			const result = yield this.perform('getStorageAt', params);
			try {
				return hexlify(result);
			} catch (error) {
				return logger$1.throwError('bad result from backend', Logger.errors.SERVER_ERROR, {
					method: 'getStorageAt',
					params,
					result,
					error,
				});
			}
		});
	}
	// This should be called by any subclass wrapping a TransactionResponse
	_wrapTransaction(tx, hash2, startBlock) {
		if (hash2 != null && hexDataLength(hash2) !== 32) {
			throw new Error('invalid response - sendTransaction');
		}
		const result = tx;
		if (hash2 != null && tx.hash !== hash2) {
			logger$1.throwError('Transaction hash mismatch from Provider.sendTransaction.', Logger.errors.UNKNOWN_ERROR, {
				expectedHash: tx.hash,
				returnedHash: hash2,
			});
		}
		result.wait = (confirms, timeout) =>
			__awaiter$1(this, void 0, void 0, function* () {
				if (confirms == null) {
					confirms = 1;
				}
				if (timeout == null) {
					timeout = 0;
				}
				let replacement = void 0;
				if (confirms !== 0 && startBlock != null) {
					replacement = {
						data: tx.data,
						from: tx.from,
						nonce: tx.nonce,
						to: tx.to,
						value: tx.value,
						startBlock,
					};
				}
				const receipt = yield this._waitForTransaction(tx.hash, confirms, timeout, replacement);
				if (receipt == null && confirms === 0) {
					return null;
				}
				this._emitted['t:' + tx.hash] = receipt.blockNumber;
				if (receipt.status === 0) {
					logger$1.throwError('transaction failed', Logger.errors.CALL_EXCEPTION, {
						transactionHash: tx.hash,
						transaction: tx,
						receipt,
					});
				}
				return receipt;
			});
		return result;
	}
	sendTransaction(signedTransaction) {
		return __awaiter$1(this, void 0, void 0, function* () {
			yield this.getNetwork();
			const hexTx = yield Promise.resolve(signedTransaction).then((t) => hexlify(t));
			const tx = this.formatter.transaction(signedTransaction);
			if (tx.confirmations == null) {
				tx.confirmations = 0;
			}
			const blockNumber = yield this._getInternalBlockNumber(100 + 2 * this.pollingInterval);
			try {
				const hash2 = yield this.perform('sendTransaction', { signedTransaction: hexTx });
				return this._wrapTransaction(tx, hash2, blockNumber);
			} catch (error) {
				error.transaction = tx;
				error.transactionHash = tx.hash;
				throw error;
			}
		});
	}
	_getTransactionRequest(transaction) {
		return __awaiter$1(this, void 0, void 0, function* () {
			const values = yield transaction;
			const tx = {};
			['from', 'to'].forEach((key2) => {
				if (values[key2] == null) {
					return;
				}
				tx[key2] = Promise.resolve(values[key2]).then((v) => (v ? this._getAddress(v) : null));
			});
			['gasLimit', 'gasPrice', 'maxFeePerGas', 'maxPriorityFeePerGas', 'value'].forEach((key2) => {
				if (values[key2] == null) {
					return;
				}
				tx[key2] = Promise.resolve(values[key2]).then((v) => (v ? BigNumber.from(v) : null));
			});
			['type'].forEach((key2) => {
				if (values[key2] == null) {
					return;
				}
				tx[key2] = Promise.resolve(values[key2]).then((v) => (v != null ? v : null));
			});
			if (values.accessList) {
				tx.accessList = this.formatter.accessList(values.accessList);
			}
			['data'].forEach((key2) => {
				if (values[key2] == null) {
					return;
				}
				tx[key2] = Promise.resolve(values[key2]).then((v) => (v ? hexlify(v) : null));
			});
			return this.formatter.transactionRequest(yield resolveProperties(tx));
		});
	}
	_getFilter(filter) {
		return __awaiter$1(this, void 0, void 0, function* () {
			filter = yield filter;
			const result = {};
			if (filter.address != null) {
				result.address = this._getAddress(filter.address);
			}
			['blockHash', 'topics'].forEach((key2) => {
				if (filter[key2] == null) {
					return;
				}
				result[key2] = filter[key2];
			});
			['fromBlock', 'toBlock'].forEach((key2) => {
				if (filter[key2] == null) {
					return;
				}
				result[key2] = this._getBlockTag(filter[key2]);
			});
			return this.formatter.filter(yield resolveProperties(result));
		});
	}
	_call(transaction, blockTag, attempt) {
		return __awaiter$1(this, void 0, void 0, function* () {
			if (attempt >= MAX_CCIP_REDIRECTS) {
				logger$1.throwError('CCIP read exceeded maximum redirections', Logger.errors.SERVER_ERROR, {
					redirects: attempt,
					transaction,
				});
			}
			const txSender = transaction.to;
			const result = yield this.perform('call', { transaction, blockTag });
			if (
				attempt >= 0 &&
				blockTag === 'latest' &&
				txSender != null &&
				result.substring(0, 10) === '0x556f1830' &&
				hexDataLength(result) % 32 === 4
			) {
				try {
					const data = hexDataSlice(result, 4);
					const sender = hexDataSlice(data, 0, 32);
					if (!BigNumber.from(sender).eq(txSender)) {
						logger$1.throwError('CCIP Read sender did not match', Logger.errors.CALL_EXCEPTION, {
							name: 'OffchainLookup',
							signature: 'OffchainLookup(address,string[],bytes,bytes4,bytes)',
							transaction,
							data: result,
						});
					}
					const urls = [];
					const urlsOffset = BigNumber.from(hexDataSlice(data, 32, 64)).toNumber();
					const urlsLength = BigNumber.from(hexDataSlice(data, urlsOffset, urlsOffset + 32)).toNumber();
					const urlsData = hexDataSlice(data, urlsOffset + 32);
					for (let u = 0; u < urlsLength; u++) {
						const url = _parseString(urlsData, u * 32);
						if (url == null) {
							logger$1.throwError('CCIP Read contained corrupt URL string', Logger.errors.CALL_EXCEPTION, {
								name: 'OffchainLookup',
								signature: 'OffchainLookup(address,string[],bytes,bytes4,bytes)',
								transaction,
								data: result,
							});
						}
						urls.push(url);
					}
					const calldata = _parseBytes(data, 64);
					if (!BigNumber.from(hexDataSlice(data, 100, 128)).isZero()) {
						logger$1.throwError('CCIP Read callback selector included junk', Logger.errors.CALL_EXCEPTION, {
							name: 'OffchainLookup',
							signature: 'OffchainLookup(address,string[],bytes,bytes4,bytes)',
							transaction,
							data: result,
						});
					}
					const callbackSelector = hexDataSlice(data, 96, 100);
					const extraData = _parseBytes(data, 128);
					const ccipResult = yield this.ccipReadFetch(transaction, calldata, urls);
					if (ccipResult == null) {
						logger$1.throwError('CCIP Read disabled or provided no URLs', Logger.errors.CALL_EXCEPTION, {
							name: 'OffchainLookup',
							signature: 'OffchainLookup(address,string[],bytes,bytes4,bytes)',
							transaction,
							data: result,
						});
					}
					const tx = {
						to: txSender,
						data: hexConcat([callbackSelector, encodeBytes([ccipResult, extraData])]),
					};
					return this._call(tx, blockTag, attempt + 1);
				} catch (error) {
					if (error.code === Logger.errors.SERVER_ERROR) {
						throw error;
					}
				}
			}
			try {
				return hexlify(result);
			} catch (error) {
				return logger$1.throwError('bad result from backend', Logger.errors.SERVER_ERROR, {
					method: 'call',
					params: { transaction, blockTag },
					result,
					error,
				});
			}
		});
	}
	call(transaction, blockTag) {
		return __awaiter$1(this, void 0, void 0, function* () {
			yield this.getNetwork();
			const resolved = yield resolveProperties({
				transaction: this._getTransactionRequest(transaction),
				blockTag: this._getBlockTag(blockTag),
				ccipReadEnabled: Promise.resolve(transaction.ccipReadEnabled),
			});
			return this._call(resolved.transaction, resolved.blockTag, resolved.ccipReadEnabled ? 0 : -1);
		});
	}
	estimateGas(transaction) {
		return __awaiter$1(this, void 0, void 0, function* () {
			yield this.getNetwork();
			const params = yield resolveProperties({
				transaction: this._getTransactionRequest(transaction),
			});
			const result = yield this.perform('estimateGas', params);
			try {
				return BigNumber.from(result);
			} catch (error) {
				return logger$1.throwError('bad result from backend', Logger.errors.SERVER_ERROR, {
					method: 'estimateGas',
					params,
					result,
					error,
				});
			}
		});
	}
	_getAddress(addressOrName) {
		return __awaiter$1(this, void 0, void 0, function* () {
			addressOrName = yield addressOrName;
			if (typeof addressOrName !== 'string') {
				logger$1.throwArgumentError('invalid address or ENS name', 'name', addressOrName);
			}
			const address = yield this.resolveName(addressOrName);
			if (address == null) {
				logger$1.throwError('ENS name not configured', Logger.errors.UNSUPPORTED_OPERATION, {
					operation: `resolveName(${JSON.stringify(addressOrName)})`,
				});
			}
			return address;
		});
	}
	_getBlock(blockHashOrBlockTag, includeTransactions) {
		return __awaiter$1(this, void 0, void 0, function* () {
			yield this.getNetwork();
			blockHashOrBlockTag = yield blockHashOrBlockTag;
			let blockNumber = -128;
			const params = {
				includeTransactions: !!includeTransactions,
			};
			if (isHexString(blockHashOrBlockTag, 32)) {
				params.blockHash = blockHashOrBlockTag;
			} else {
				try {
					params.blockTag = yield this._getBlockTag(blockHashOrBlockTag);
					if (isHexString(params.blockTag)) {
						blockNumber = parseInt(params.blockTag.substring(2), 16);
					}
				} catch (error) {
					logger$1.throwArgumentError('invalid block hash or block tag', 'blockHashOrBlockTag', blockHashOrBlockTag);
				}
			}
			return poll(
				() =>
					__awaiter$1(this, void 0, void 0, function* () {
						const block = yield this.perform('getBlock', params);
						if (block == null) {
							if (params.blockHash != null) {
								if (this._emitted['b:' + params.blockHash] == null) {
									return null;
								}
							}
							if (params.blockTag != null) {
								if (blockNumber > this._emitted.block) {
									return null;
								}
							}
							return void 0;
						}
						if (includeTransactions) {
							let blockNumber2 = null;
							for (let i = 0; i < block.transactions.length; i++) {
								const tx = block.transactions[i];
								if (tx.blockNumber == null) {
									tx.confirmations = 0;
								} else if (tx.confirmations == null) {
									if (blockNumber2 == null) {
										blockNumber2 = yield this._getInternalBlockNumber(100 + 2 * this.pollingInterval);
									}
									let confirmations = blockNumber2 - tx.blockNumber + 1;
									if (confirmations <= 0) {
										confirmations = 1;
									}
									tx.confirmations = confirmations;
								}
							}
							const blockWithTxs = this.formatter.blockWithTransactions(block);
							blockWithTxs.transactions = blockWithTxs.transactions.map((tx) => this._wrapTransaction(tx));
							return blockWithTxs;
						}
						return this.formatter.block(block);
					}),
				{ oncePoll: this },
			);
		});
	}
	getBlock(blockHashOrBlockTag) {
		return this._getBlock(blockHashOrBlockTag, false);
	}
	getBlockWithTransactions(blockHashOrBlockTag) {
		return this._getBlock(blockHashOrBlockTag, true);
	}
	getTransaction(transactionHash) {
		return __awaiter$1(this, void 0, void 0, function* () {
			yield this.getNetwork();
			transactionHash = yield transactionHash;
			const params = { transactionHash: this.formatter.hash(transactionHash, true) };
			return poll(
				() =>
					__awaiter$1(this, void 0, void 0, function* () {
						const result = yield this.perform('getTransaction', params);
						if (result == null) {
							if (this._emitted['t:' + transactionHash] == null) {
								return null;
							}
							return void 0;
						}
						const tx = this.formatter.transactionResponse(result);
						if (tx.blockNumber == null) {
							tx.confirmations = 0;
						} else if (tx.confirmations == null) {
							const blockNumber = yield this._getInternalBlockNumber(100 + 2 * this.pollingInterval);
							let confirmations = blockNumber - tx.blockNumber + 1;
							if (confirmations <= 0) {
								confirmations = 1;
							}
							tx.confirmations = confirmations;
						}
						return this._wrapTransaction(tx);
					}),
				{ oncePoll: this },
			);
		});
	}
	getTransactionReceipt(transactionHash) {
		return __awaiter$1(this, void 0, void 0, function* () {
			yield this.getNetwork();
			transactionHash = yield transactionHash;
			const params = { transactionHash: this.formatter.hash(transactionHash, true) };
			return poll(
				() =>
					__awaiter$1(this, void 0, void 0, function* () {
						const result = yield this.perform('getTransactionReceipt', params);
						if (result == null) {
							if (this._emitted['t:' + transactionHash] == null) {
								return null;
							}
							return void 0;
						}
						if (result.blockHash == null) {
							return void 0;
						}
						const receipt = this.formatter.receipt(result);
						if (receipt.blockNumber == null) {
							receipt.confirmations = 0;
						} else if (receipt.confirmations == null) {
							const blockNumber = yield this._getInternalBlockNumber(100 + 2 * this.pollingInterval);
							let confirmations = blockNumber - receipt.blockNumber + 1;
							if (confirmations <= 0) {
								confirmations = 1;
							}
							receipt.confirmations = confirmations;
						}
						return receipt;
					}),
				{ oncePoll: this },
			);
		});
	}
	getLogs(filter) {
		return __awaiter$1(this, void 0, void 0, function* () {
			yield this.getNetwork();
			const params = yield resolveProperties({ filter: this._getFilter(filter) });
			const logs = yield this.perform('getLogs', params);
			logs.forEach((log) => {
				if (log.removed == null) {
					log.removed = false;
				}
			});
			return Formatter.arrayOf(this.formatter.filterLog.bind(this.formatter))(logs);
		});
	}
	getEtherPrice() {
		return __awaiter$1(this, void 0, void 0, function* () {
			yield this.getNetwork();
			return this.perform('getEtherPrice', {});
		});
	}
	_getBlockTag(blockTag) {
		return __awaiter$1(this, void 0, void 0, function* () {
			blockTag = yield blockTag;
			if (typeof blockTag === 'number' && blockTag < 0) {
				if (blockTag % 1) {
					logger$1.throwArgumentError('invalid BlockTag', 'blockTag', blockTag);
				}
				let blockNumber = yield this._getInternalBlockNumber(100 + 2 * this.pollingInterval);
				blockNumber += blockTag;
				if (blockNumber < 0) {
					blockNumber = 0;
				}
				return this.formatter.blockTag(blockNumber);
			}
			return this.formatter.blockTag(blockTag);
		});
	}
	getResolver(name) {
		return __awaiter$1(this, void 0, void 0, function* () {
			let currentName = name;
			while (true) {
				if (currentName === '' || currentName === '.') {
					return null;
				}
				if (name !== 'eth' && currentName === 'eth') {
					return null;
				}
				const addr = yield this._getResolver(currentName, 'getResolver');
				if (addr != null) {
					const resolver = new Resolver(this, addr, name);
					if (currentName !== name && !(yield resolver.supportsWildcard())) {
						return null;
					}
					return resolver;
				}
				currentName = currentName.split('.').slice(1).join('.');
			}
		});
	}
	_getResolver(name, operation) {
		return __awaiter$1(this, void 0, void 0, function* () {
			if (operation == null) {
				operation = 'ENS';
			}
			const network = yield this.getNetwork();
			if (!network.ensAddress) {
				logger$1.throwError('network does not support ENS', Logger.errors.UNSUPPORTED_OPERATION, { operation, network: network.name });
			}
			try {
				const addrData = yield this.call({
					to: network.ensAddress,
					data: '0x0178b8bf' + namehash(name).substring(2),
				});
				return this.formatter.callAddress(addrData);
			} catch (error) {}
			return null;
		});
	}
	resolveName(name) {
		return __awaiter$1(this, void 0, void 0, function* () {
			name = yield name;
			try {
				return Promise.resolve(this.formatter.address(name));
			} catch (error) {
				if (isHexString(name)) {
					throw error;
				}
			}
			if (typeof name !== 'string') {
				logger$1.throwArgumentError('invalid ENS name', 'name', name);
			}
			const resolver = yield this.getResolver(name);
			if (!resolver) {
				return null;
			}
			return yield resolver.getAddress();
		});
	}
	lookupAddress(address) {
		return __awaiter$1(this, void 0, void 0, function* () {
			address = yield address;
			address = this.formatter.address(address);
			const node = address.substring(2).toLowerCase() + '.addr.reverse';
			const resolverAddr = yield this._getResolver(node, 'lookupAddress');
			if (resolverAddr == null) {
				return null;
			}
			const name = _parseString(
				yield this.call({
					to: resolverAddr,
					data: '0x691f3431' + namehash(node).substring(2),
				}),
				0,
			);
			const addr = yield this.resolveName(name);
			if (addr != address) {
				return null;
			}
			return name;
		});
	}
	getAvatar(nameOrAddress) {
		return __awaiter$1(this, void 0, void 0, function* () {
			let resolver = null;
			if (isHexString(nameOrAddress)) {
				const address = this.formatter.address(nameOrAddress);
				const node = address.substring(2).toLowerCase() + '.addr.reverse';
				const resolverAddress = yield this._getResolver(node, 'getAvatar');
				if (!resolverAddress) {
					return null;
				}
				resolver = new Resolver(this, resolverAddress, node);
				try {
					const avatar2 = yield resolver.getAvatar();
					if (avatar2) {
						return avatar2.url;
					}
				} catch (error) {
					if (error.code !== Logger.errors.CALL_EXCEPTION) {
						throw error;
					}
				}
				try {
					const name = _parseString(
						yield this.call({
							to: resolverAddress,
							data: '0x691f3431' + namehash(node).substring(2),
						}),
						0,
					);
					resolver = yield this.getResolver(name);
				} catch (error) {
					if (error.code !== Logger.errors.CALL_EXCEPTION) {
						throw error;
					}
					return null;
				}
			} else {
				resolver = yield this.getResolver(nameOrAddress);
				if (!resolver) {
					return null;
				}
			}
			const avatar = yield resolver.getAvatar();
			if (avatar == null) {
				return null;
			}
			return avatar.url;
		});
	}
	perform(method, params) {
		return logger$1.throwError(method + ' not implemented', Logger.errors.NOT_IMPLEMENTED, { operation: method });
	}
	_startEvent(event) {
		this.polling = this._events.filter((e) => e.pollable()).length > 0;
	}
	_stopEvent(event) {
		this.polling = this._events.filter((e) => e.pollable()).length > 0;
	}
	_addEventListener(eventName, listener, once) {
		const event = new Event(getEventTag(eventName), listener, once);
		this._events.push(event);
		this._startEvent(event);
		return this;
	}
	on(eventName, listener) {
		return this._addEventListener(eventName, listener, false);
	}
	once(eventName, listener) {
		return this._addEventListener(eventName, listener, true);
	}
	emit(eventName, ...args) {
		let result = false;
		let stopped = [];
		let eventTag = getEventTag(eventName);
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
	}
	listenerCount(eventName) {
		if (!eventName) {
			return this._events.length;
		}
		let eventTag = getEventTag(eventName);
		return this._events.filter((event) => {
			return event.tag === eventTag;
		}).length;
	}
	listeners(eventName) {
		if (eventName == null) {
			return this._events.map((event) => event.listener);
		}
		let eventTag = getEventTag(eventName);
		return this._events.filter((event) => event.tag === eventTag).map((event) => event.listener);
	}
	off(eventName, listener) {
		if (listener == null) {
			return this.removeAllListeners(eventName);
		}
		const stopped = [];
		let found = false;
		let eventTag = getEventTag(eventName);
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
	removeAllListeners(eventName) {
		let stopped = [];
		if (eventName == null) {
			stopped = this._events;
			this._events = [];
		} else {
			const eventTag = getEventTag(eventName);
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
const errorGas = ['call', 'estimateGas'];
function spelunk(value, requireData) {
	if (value == null) {
		return null;
	}
	if (typeof value.message === 'string' && value.message.match('reverted')) {
		const data = isHexString(value.data) ? value.data : null;
		if (!requireData || data) {
			return { message: value.message, data };
		}
	}
	if (typeof value === 'object') {
		for (const key2 in value) {
			const result = spelunk(value[key2], requireData);
			if (result) {
				return result;
			}
		}
		return null;
	}
	if (typeof value === 'string') {
		try {
			return spelunk(JSON.parse(value), requireData);
		} catch (error) {}
	}
	return null;
}
function checkError(method, error, params) {
	const transaction = params.transaction || params.signedTransaction;
	if (method === 'call') {
		const result = spelunk(error, true);
		if (result) {
			return result.data;
		}
		logger.throwError('missing revert data in call exception; Transaction reverted without a reason string', Logger.errors.CALL_EXCEPTION, {
			data: '0x',
			transaction,
			error,
		});
	}
	if (method === 'estimateGas') {
		let result = spelunk(error.body, false);
		if (result == null) {
			result = spelunk(error, false);
		}
		if (result) {
			logger.throwError(
				'cannot estimate gas; transaction may fail or may require manual gas limit',
				Logger.errors.UNPREDICTABLE_GAS_LIMIT,
				{
					reason: result.message,
					method,
					transaction,
					error,
				},
			);
		}
	}
	let message = error.message;
	if (error.code === Logger.errors.SERVER_ERROR && error.error && typeof error.error.message === 'string') {
		message = error.error.message;
	} else if (typeof error.body === 'string') {
		message = error.body;
	} else if (typeof error.responseText === 'string') {
		message = error.responseText;
	}
	message = (message || '').toLowerCase();
	if (message.match(/insufficient funds|base fee exceeds gas limit|InsufficientFunds/i)) {
		logger.throwError('insufficient funds for intrinsic transaction cost', Logger.errors.INSUFFICIENT_FUNDS, {
			error,
			method,
			transaction,
		});
	}
	if (message.match(/nonce (is )?too low/i)) {
		logger.throwError('nonce has already been used', Logger.errors.NONCE_EXPIRED, {
			error,
			method,
			transaction,
		});
	}
	if (message.match(/replacement transaction underpriced|transaction gas price.*too low/i)) {
		logger.throwError('replacement fee too low', Logger.errors.REPLACEMENT_UNDERPRICED, {
			error,
			method,
			transaction,
		});
	}
	if (message.match(/only replay-protected/i)) {
		logger.throwError('legacy pre-eip-155 transactions not supported', Logger.errors.UNSUPPORTED_OPERATION, {
			error,
			method,
			transaction,
		});
	}
	if (
		errorGas.indexOf(method) >= 0 &&
		message.match(/gas required exceeds allowance|always failing transaction|execution reverted|revert/)
	) {
		logger.throwError('cannot estimate gas; transaction may fail or may require manual gas limit', Logger.errors.UNPREDICTABLE_GAS_LIMIT, {
			error,
			method,
			transaction,
		});
	}
	throw error;
}
function timer(timeout) {
	return new Promise(function (resolve) {
		setTimeout(resolve, timeout);
	});
}
function getResult$1(payload) {
	if (payload.error) {
		const error = new Error(payload.error.message);
		error.code = payload.error.code;
		error.data = payload.error.data;
		throw error;
	}
	return payload.result;
}
function getLowerCase(value) {
	if (value) {
		return value.toLowerCase();
	}
	return value;
}
const _constructorGuard = {};
class JsonRpcSigner extends Signer {
	constructor(constructorGuard, provider, addressOrIndex) {
		super();
		if (constructorGuard !== _constructorGuard) {
			throw new Error('do not call the JsonRpcSigner constructor directly; use provider.getSigner');
		}
		defineReadOnly(this, 'provider', provider);
		if (addressOrIndex == null) {
			addressOrIndex = 0;
		}
		if (typeof addressOrIndex === 'string') {
			defineReadOnly(this, '_address', this.provider.formatter.address(addressOrIndex));
			defineReadOnly(this, '_index', null);
		} else if (typeof addressOrIndex === 'number') {
			defineReadOnly(this, '_index', addressOrIndex);
			defineReadOnly(this, '_address', null);
		} else {
			logger.throwArgumentError('invalid address or index', 'addressOrIndex', addressOrIndex);
		}
	}
	connect(provider) {
		return logger.throwError('cannot alter JSON-RPC Signer connection', Logger.errors.UNSUPPORTED_OPERATION, {
			operation: 'connect',
		});
	}
	connectUnchecked() {
		return new UncheckedJsonRpcSigner(_constructorGuard, this.provider, this._address || this._index);
	}
	getAddress() {
		if (this._address) {
			return Promise.resolve(this._address);
		}
		return this.provider.send('eth_accounts', []).then((accounts) => {
			if (accounts.length <= this._index) {
				logger.throwError('unknown account #' + this._index, Logger.errors.UNSUPPORTED_OPERATION, {
					operation: 'getAddress',
				});
			}
			return this.provider.formatter.address(accounts[this._index]);
		});
	}
	sendUncheckedTransaction(transaction) {
		transaction = shallowCopy(transaction);
		const fromAddress = this.getAddress().then((address) => {
			if (address) {
				address = address.toLowerCase();
			}
			return address;
		});
		if (transaction.gasLimit == null) {
			const estimate = shallowCopy(transaction);
			estimate.from = fromAddress;
			transaction.gasLimit = this.provider.estimateGas(estimate);
		}
		if (transaction.to != null) {
			transaction.to = Promise.resolve(transaction.to).then((to) =>
				__awaiter(this, void 0, void 0, function* () {
					if (to == null) {
						return null;
					}
					const address = yield this.provider.resolveName(to);
					if (address == null) {
						logger.throwArgumentError('provided ENS name resolves to null', 'tx.to', to);
					}
					return address;
				}),
			);
		}
		return resolveProperties({
			tx: resolveProperties(transaction),
			sender: fromAddress,
		}).then(({ tx, sender }) => {
			if (tx.from != null) {
				if (tx.from.toLowerCase() !== sender) {
					logger.throwArgumentError('from address mismatch', 'transaction', transaction);
				}
			} else {
				tx.from = sender;
			}
			const hexTx = this.provider.constructor.hexlifyTransaction(tx, { from: true });
			return this.provider.send('eth_sendTransaction', [hexTx]).then(
				(hash2) => {
					return hash2;
				},
				(error) => {
					if (typeof error.message === 'string' && error.message.match(/user denied/i)) {
						logger.throwError('user rejected transaction', Logger.errors.ACTION_REJECTED, {
							action: 'sendTransaction',
							transaction: tx,
						});
					}
					return checkError('sendTransaction', error, hexTx);
				},
			);
		});
	}
	signTransaction(transaction) {
		return logger.throwError('signing transactions is unsupported', Logger.errors.UNSUPPORTED_OPERATION, {
			operation: 'signTransaction',
		});
	}
	sendTransaction(transaction) {
		return __awaiter(this, void 0, void 0, function* () {
			const blockNumber = yield this.provider._getInternalBlockNumber(100 + 2 * this.provider.pollingInterval);
			const hash2 = yield this.sendUncheckedTransaction(transaction);
			try {
				return yield poll(
					() =>
						__awaiter(this, void 0, void 0, function* () {
							const tx = yield this.provider.getTransaction(hash2);
							if (tx === null) {
								return void 0;
							}
							return this.provider._wrapTransaction(tx, hash2, blockNumber);
						}),
					{ oncePoll: this.provider },
				);
			} catch (error) {
				error.transactionHash = hash2;
				throw error;
			}
		});
	}
	signMessage(message) {
		return __awaiter(this, void 0, void 0, function* () {
			const data = typeof message === 'string' ? toUtf8Bytes(message) : message;
			const address = yield this.getAddress();
			try {
				return yield this.provider.send('personal_sign', [hexlify(data), address.toLowerCase()]);
			} catch (error) {
				if (typeof error.message === 'string' && error.message.match(/user denied/i)) {
					logger.throwError('user rejected signing', Logger.errors.ACTION_REJECTED, {
						action: 'signMessage',
						from: address,
						messageData: message,
					});
				}
				throw error;
			}
		});
	}
	_legacySignMessage(message) {
		return __awaiter(this, void 0, void 0, function* () {
			const data = typeof message === 'string' ? toUtf8Bytes(message) : message;
			const address = yield this.getAddress();
			try {
				return yield this.provider.send('eth_sign', [address.toLowerCase(), hexlify(data)]);
			} catch (error) {
				if (typeof error.message === 'string' && error.message.match(/user denied/i)) {
					logger.throwError('user rejected signing', Logger.errors.ACTION_REJECTED, {
						action: '_legacySignMessage',
						from: address,
						messageData: message,
					});
				}
				throw error;
			}
		});
	}
	_signTypedData(domain, types, value) {
		return __awaiter(this, void 0, void 0, function* () {
			const populated = yield TypedDataEncoder.resolveNames(domain, types, value, (name) => {
				return this.provider.resolveName(name);
			});
			const address = yield this.getAddress();
			try {
				return yield this.provider.send('eth_signTypedData_v4', [
					address.toLowerCase(),
					JSON.stringify(TypedDataEncoder.getPayload(populated.domain, types, populated.value)),
				]);
			} catch (error) {
				if (typeof error.message === 'string' && error.message.match(/user denied/i)) {
					logger.throwError('user rejected signing', Logger.errors.ACTION_REJECTED, {
						action: '_signTypedData',
						from: address,
						messageData: { domain: populated.domain, types, value: populated.value },
					});
				}
				throw error;
			}
		});
	}
	unlock(password) {
		return __awaiter(this, void 0, void 0, function* () {
			const provider = this.provider;
			const address = yield this.getAddress();
			return provider.send('personal_unlockAccount', [address.toLowerCase(), password, null]);
		});
	}
}
class UncheckedJsonRpcSigner extends JsonRpcSigner {
	sendTransaction(transaction) {
		return this.sendUncheckedTransaction(transaction).then((hash2) => {
			return {
				hash: hash2,
				nonce: null,
				gasLimit: null,
				gasPrice: null,
				data: null,
				value: null,
				chainId: null,
				confirmations: 0,
				from: null,
				wait: (confirmations) => {
					return this.provider.waitForTransaction(hash2, confirmations);
				},
			};
		});
	}
}
const allowedTransactionKeys = {
	chainId: true,
	data: true,
	gasLimit: true,
	gasPrice: true,
	nonce: true,
	to: true,
	value: true,
	type: true,
	accessList: true,
	maxFeePerGas: true,
	maxPriorityFeePerGas: true,
};
class JsonRpcProvider extends BaseProvider {
	constructor(url, network) {
		let networkOrReady = network;
		if (networkOrReady == null) {
			networkOrReady = new Promise((resolve, reject) => {
				setTimeout(() => {
					this.detectNetwork().then(
						(network2) => {
							resolve(network2);
						},
						(error) => {
							reject(error);
						},
					);
				}, 0);
			});
		}
		super(networkOrReady);
		if (!url) {
			url = getStatic(this.constructor, 'defaultUrl')();
		}
		if (typeof url === 'string') {
			defineReadOnly(
				this,
				'connection',
				Object.freeze({
					url,
				}),
			);
		} else {
			defineReadOnly(this, 'connection', Object.freeze(shallowCopy(url)));
		}
		this._nextId = 42;
	}
	get _cache() {
		if (this._eventLoopCache == null) {
			this._eventLoopCache = {};
		}
		return this._eventLoopCache;
	}
	static defaultUrl() {
		return 'http://localhost:8545';
	}
	detectNetwork() {
		if (!this._cache['detectNetwork']) {
			this._cache['detectNetwork'] = this._uncachedDetectNetwork();
			setTimeout(() => {
				this._cache['detectNetwork'] = null;
			}, 0);
		}
		return this._cache['detectNetwork'];
	}
	_uncachedDetectNetwork() {
		return __awaiter(this, void 0, void 0, function* () {
			yield timer(0);
			let chainId = null;
			try {
				chainId = yield this.send('eth_chainId', []);
			} catch (error) {
				try {
					chainId = yield this.send('net_version', []);
				} catch (error2) {}
			}
			if (chainId != null) {
				const getNetwork2 = getStatic(this.constructor, 'getNetwork');
				try {
					return getNetwork2(BigNumber.from(chainId).toNumber());
				} catch (error) {
					return logger.throwError('could not detect network', Logger.errors.NETWORK_ERROR, {
						chainId,
						event: 'invalidNetwork',
						serverError: error,
					});
				}
			}
			return logger.throwError('could not detect network', Logger.errors.NETWORK_ERROR, {
				event: 'noNetwork',
			});
		});
	}
	getSigner(addressOrIndex) {
		return new JsonRpcSigner(_constructorGuard, this, addressOrIndex);
	}
	getUncheckedSigner(addressOrIndex) {
		return this.getSigner(addressOrIndex).connectUnchecked();
	}
	listAccounts() {
		return this.send('eth_accounts', []).then((accounts) => {
			return accounts.map((a) => this.formatter.address(a));
		});
	}
	send(method, params) {
		const request = {
			method,
			params,
			id: this._nextId++,
			jsonrpc: '2.0',
		};
		this.emit('debug', {
			action: 'request',
			request: deepCopy(request),
			provider: this,
		});
		const cache = ['eth_chainId', 'eth_blockNumber'].indexOf(method) >= 0;
		if (cache && this._cache[method]) {
			return this._cache[method];
		}
		const result = fetchJson(this.connection, JSON.stringify(request), getResult$1).then(
			(result2) => {
				this.emit('debug', {
					action: 'response',
					request,
					response: result2,
					provider: this,
				});
				return result2;
			},
			(error) => {
				this.emit('debug', {
					action: 'response',
					error,
					request,
					provider: this,
				});
				throw error;
			},
		);
		if (cache) {
			this._cache[method] = result;
			setTimeout(() => {
				this._cache[method] = null;
			}, 0);
		}
		return result;
	}
	prepareRequest(method, params) {
		switch (method) {
			case 'getBlockNumber':
				return ['eth_blockNumber', []];
			case 'getGasPrice':
				return ['eth_gasPrice', []];
			case 'getBalance':
				return ['eth_getBalance', [getLowerCase(params.address), params.blockTag]];
			case 'getTransactionCount':
				return ['eth_getTransactionCount', [getLowerCase(params.address), params.blockTag]];
			case 'getCode':
				return ['eth_getCode', [getLowerCase(params.address), params.blockTag]];
			case 'getStorageAt':
				return ['eth_getStorageAt', [getLowerCase(params.address), hexZeroPad(params.position, 32), params.blockTag]];
			case 'sendTransaction':
				return ['eth_sendRawTransaction', [params.signedTransaction]];
			case 'getBlock':
				if (params.blockTag) {
					return ['eth_getBlockByNumber', [params.blockTag, !!params.includeTransactions]];
				} else if (params.blockHash) {
					return ['eth_getBlockByHash', [params.blockHash, !!params.includeTransactions]];
				}
				return null;
			case 'getTransaction':
				return ['eth_getTransactionByHash', [params.transactionHash]];
			case 'getTransactionReceipt':
				return ['eth_getTransactionReceipt', [params.transactionHash]];
			case 'call': {
				const hexlifyTransaction = getStatic(this.constructor, 'hexlifyTransaction');
				return ['eth_call', [hexlifyTransaction(params.transaction, { from: true }), params.blockTag]];
			}
			case 'estimateGas': {
				const hexlifyTransaction = getStatic(this.constructor, 'hexlifyTransaction');
				return ['eth_estimateGas', [hexlifyTransaction(params.transaction, { from: true })]];
			}
			case 'getLogs':
				if (params.filter && params.filter.address != null) {
					params.filter.address = getLowerCase(params.filter.address);
				}
				return ['eth_getLogs', [params.filter]];
		}
		return null;
	}
	perform(method, params) {
		return __awaiter(this, void 0, void 0, function* () {
			if (method === 'call' || method === 'estimateGas') {
				const tx = params.transaction;
				if (tx && tx.type != null && BigNumber.from(tx.type).isZero()) {
					if (tx.maxFeePerGas == null && tx.maxPriorityFeePerGas == null) {
						const feeData = yield this.getFeeData();
						if (feeData.maxFeePerGas == null && feeData.maxPriorityFeePerGas == null) {
							params = shallowCopy(params);
							params.transaction = shallowCopy(tx);
							delete params.transaction.type;
						}
					}
				}
			}
			const args = this.prepareRequest(method, params);
			if (args == null) {
				logger.throwError(method + ' not implemented', Logger.errors.NOT_IMPLEMENTED, { operation: method });
			}
			try {
				return yield this.send(args[0], args[1]);
			} catch (error) {
				return checkError(method, error, params);
			}
		});
	}
	_startEvent(event) {
		if (event.tag === 'pending') {
			this._startPending();
		}
		super._startEvent(event);
	}
	_startPending() {
		if (this._pendingFilter != null) {
			return;
		}
		const self2 = this;
		const pendingFilter = this.send('eth_newPendingTransactionFilter', []);
		this._pendingFilter = pendingFilter;
		pendingFilter
			.then(function (filterId) {
				function poll2() {
					self2
						.send('eth_getFilterChanges', [filterId])
						.then(function (hashes) {
							if (self2._pendingFilter != pendingFilter) {
								return null;
							}
							let seq = Promise.resolve();
							hashes.forEach(function (hash2) {
								self2._emitted['t:' + hash2.toLowerCase()] = 'pending';
								seq = seq.then(function () {
									return self2.getTransaction(hash2).then(function (tx) {
										self2.emit('pending', tx);
										return null;
									});
								});
							});
							return seq.then(function () {
								return timer(1e3);
							});
						})
						.then(function () {
							if (self2._pendingFilter != pendingFilter) {
								self2.send('eth_uninstallFilter', [filterId]);
								return;
							}
							setTimeout(function () {
								poll2();
							}, 0);
							return null;
						})
						.catch((error) => {});
				}
				poll2();
				return filterId;
			})
			.catch((error) => {});
	}
	_stopEvent(event) {
		if (event.tag === 'pending' && this.listenerCount('pending') === 0) {
			this._pendingFilter = null;
		}
		super._stopEvent(event);
	}
	// Convert an ethers.js transaction into a JSON-RPC transaction
	//  - gasLimit => gas
	//  - All values hexlified
	//  - All numeric values zero-striped
	//  - All addresses are lowercased
	// NOTE: This allows a TransactionRequest, but all values should be resolved
	//       before this is called
	// @TODO: This will likely be removed in future versions and prepareRequest
	//        will be the preferred method for this.
	static hexlifyTransaction(transaction, allowExtra) {
		const allowed = shallowCopy(allowedTransactionKeys);
		if (allowExtra) {
			for (const key2 in allowExtra) {
				if (allowExtra[key2]) {
					allowed[key2] = true;
				}
			}
		}
		checkProperties(transaction, allowed);
		const result = {};
		['chainId', 'gasLimit', 'gasPrice', 'type', 'maxFeePerGas', 'maxPriorityFeePerGas', 'nonce', 'value'].forEach(function (key2) {
			if (transaction[key2] == null) {
				return;
			}
			const value = hexValue(BigNumber.from(transaction[key2]));
			if (key2 === 'gasLimit') {
				key2 = 'gas';
			}
			result[key2] = value;
		});
		['from', 'to', 'data'].forEach(function (key2) {
			if (transaction[key2] == null) {
				return;
			}
			result[key2] = hexlify(transaction[key2]);
		});
		if (transaction.accessList) {
			result['accessList'] = accessListify(transaction.accessList);
		}
		return result;
	}
}
const DEFAULT_MAX_REQUEST_BATCH_SIZE = 100;
const DEFAULT_REQUEST_BATCH_DELAY_MS = 10;
class RequestBatcher {
	constructor(sendBatchFn, maxBatchSize = DEFAULT_MAX_REQUEST_BATCH_SIZE) {
		this.sendBatchFn = sendBatchFn;
		this.maxBatchSize = maxBatchSize;
		this.pendingBatch = [];
	}
	/**
	 * Enqueues the provided request. The batch is immediately sent if the maximum
	 * batch size is reached. Otherwise, the request is enqueued onto a batch that
	 * is sent after 10ms.
	 *
	 * Returns a promise that resolves with the result of the request.
	 */
	enqueueRequest(request) {
		return __awaiter$1$1(this, void 0, void 0, function* () {
			const inflightRequest = {
				request,
				resolve: void 0,
				reject: void 0,
			};
			const promise = new Promise((resolve, reject) => {
				inflightRequest.resolve = resolve;
				inflightRequest.reject = reject;
			});
			this.pendingBatch.push(inflightRequest);
			if (this.pendingBatch.length === this.maxBatchSize) {
				void this.sendBatchRequest();
			} else if (!this.pendingBatchTimer) {
				this.pendingBatchTimer = setTimeout(() => this.sendBatchRequest(), DEFAULT_REQUEST_BATCH_DELAY_MS);
			}
			return promise;
		});
	}
	/**
	 * Sends the currently queued batches and resets the batch and timer. Processes
	 * the batched response results back to the original promises.
	 */
	sendBatchRequest() {
		return __awaiter$1$1(this, void 0, void 0, function* () {
			const batch = this.pendingBatch;
			this.pendingBatch = [];
			if (this.pendingBatchTimer) {
				clearTimeout(this.pendingBatchTimer);
				this.pendingBatchTimer = void 0;
			}
			const request = batch.map((inflight) => inflight.request);
			return this.sendBatchFn(request).then(
				(result) => {
					batch.forEach((inflightRequest, index) => {
						const payload = result[index];
						if (payload.error) {
							const error = new Error(payload.error.message);
							error.code = payload.error.code;
							error.data = payload.error.data;
							inflightRequest.reject(error);
						} else {
							inflightRequest.resolve(payload.result);
						}
					});
				},
				(error) => {
					batch.forEach((inflightRequest) => {
						inflightRequest.reject(error);
					});
				},
			);
		});
	}
}
class AlchemyProvider extends JsonRpcProvider {
	/** @internal */
	constructor(config) {
		const apiKey = AlchemyProvider.getApiKey(config.apiKey);
		const alchemyNetwork = AlchemyProvider.getAlchemyNetwork(config.network);
		let connection = AlchemyProvider.getAlchemyConnectionInfo(alchemyNetwork, apiKey, 'http');
		if (config.url !== void 0) {
			connection.url = config.url;
		}
		connection.throttleLimit = config.maxRetries;
		if (config.connectionInfoOverrides) {
			connection = Object.assign(Object.assign({}, connection), config.connectionInfoOverrides);
		}
		const ethersNetwork = EthersNetwork[alchemyNetwork];
		if (!ethersNetwork) {
			throw new Error(`Unsupported network: ${alchemyNetwork}`);
		}
		super(connection, ethersNetwork);
		this.apiKey = config.apiKey;
		this.maxRetries = config.maxRetries;
		this.batchRequests = config.batchRequests;
		const batcherConnection = Object.assign(Object.assign({}, this.connection), {
			headers: Object.assign(Object.assign({}, this.connection.headers), { 'Alchemy-Ethers-Sdk-Method': 'batchSend' }),
		});
		const sendBatchFn = (requests) => {
			return fetchJson(batcherConnection, JSON.stringify(requests));
		};
		this.batcher = new RequestBatcher(sendBatchFn);
		this.modifyFormatter();
	}
	/**
	 * Overrides the `UrlJsonRpcProvider.getApiKey` method as implemented by
	 * ethers.js. Returns the API key for an Alchemy provider.
	 *
	 * @internal
	 * @override
	 */
	static getApiKey(apiKey) {
		if (apiKey == null) {
			return DEFAULT_ALCHEMY_API_KEY;
		}
		if (apiKey && typeof apiKey !== 'string') {
			throw new Error(`Invalid apiKey '${apiKey}' provided. apiKey must be a string.`);
		}
		return apiKey;
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
	 * Converts the `Networkish` input to the network enum used by Alchemy.
	 *
	 * @internal
	 */
	static getAlchemyNetwork(network) {
		if (network === void 0) {
			return DEFAULT_NETWORK;
		}
		if (typeof network === 'number') {
			throw new Error(`Invalid network '${network}' provided. Network must be a string.`);
		}
		const isValidNetwork = Object.values(Network).includes(network);
		if (!isValidNetwork) {
			throw new Error(`Invalid network '${network}' provided. Network must be one of: ${Object.values(Network).join(', ')}.`);
		}
		return network;
	}
	/**
	 * Returns a {@link ConnectionInfo} object compatible with ethers that contains
	 * the correct URLs for Alchemy.
	 *
	 * @internal
	 */
	static getAlchemyConnectionInfo(network, apiKey, type) {
		const url = type === 'http' ? getAlchemyHttpUrl(network, apiKey) : getAlchemyWsUrl(network, apiKey);
		return {
			headers: IS_BROWSER
				? {
						'Alchemy-Ethers-Sdk-Version': VERSION,
					}
				: {
						'Alchemy-Ethers-Sdk-Version': VERSION,
						'Accept-Encoding': 'gzip',
					},
			allowGzip: true,
			url,
		};
	}
	/**
	 * Overrides the method in ethers.js's `StaticJsonRpcProvider` class. This
	 * method is called when calling methods on the parent class `BaseProvider`.
	 *
	 * @override
	 */
	detectNetwork() {
		const _super = Object.create(null, {
			detectNetwork: { get: () => super.detectNetwork },
		});
		return __awaiter$1$1(this, void 0, void 0, function* () {
			let network = this.network;
			if (network == null) {
				network = yield _super.detectNetwork.call(this);
				if (!network) {
					throw new Error('No network detected');
				}
			}
			return network;
		});
	}
	_startPending() {
		logWarn('WARNING: Alchemy Provider does not support pending filters');
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
	 * Overrides the base {@link JsonRpcProvider.send} method to implement custom
	 * logic for sending requests to Alchemy.
	 *
	 * @param method The method name to use for the request.
	 * @param params The parameters to use for the request.
	 * @override
	 * @public
	 */
	// TODO: Add headers for `perform()` override.
	send(method, params) {
		return this._send(method, params, 'send');
	}
	/**
	 * DO NOT MODIFY.
	 *
	 * Original code copied over from ether.js's `JsonRpcProvider.send()`.
	 *
	 * This method is copied over directly in order to implement custom headers
	 *
	 * @internal
	 */
	_send(method, params, methodName) {
		const request = {
			method,
			params,
			id: this._nextId++,
			jsonrpc: '2.0',
		};
		const connection = Object.assign({}, this.connection);
		connection.headers['Alchemy-Ethers-Sdk-Method'] = methodName;
		if (this.batchRequests) {
			return this.batcher.enqueueRequest(request);
		}
		this.emit('debug', {
			action: 'request',
			request: deepCopy$1(request),
			provider: this,
		});
		const cache = ['eth_chainId', 'eth_blockNumber'].indexOf(method) >= 0;
		if (cache && this._cache[method]) {
			return this._cache[method];
		}
		const result = fetchJson(this.connection, JSON.stringify(request), getResult).then(
			(result2) => {
				this.emit('debug', {
					action: 'response',
					request,
					response: result2,
					provider: this,
				});
				return result2;
			},
			(error) => {
				this.emit('debug', {
					action: 'response',
					error,
					request,
					provider: this,
				});
				throw error;
			},
		);
		if (cache) {
			this._cache[method] = result;
			setTimeout(() => {
				this._cache[method] = null;
			}, 0);
		}
		return result;
	}
	/**
	 * Overrides the base `Formatter` class inherited from ethers to support
	 * returning custom fields in Ethers response types.
	 *
	 * For context, ethers has a `Formatter` class that is used to format the
	 * response from a JSON-RPC request. Any fields that are not defined in the
	 * `Formatter` class are removed from the returned response. By modifying the
	 * `Formatter` class in this method, we can add support for fields that are
	 * not defined in ethers.
	 */
	modifyFormatter() {
		this.formatter.formats['receiptLog']['removed'] = (val) => {
			if (typeof val === 'boolean') {
				return val;
			}
			return void 0;
		};
	}
}
function getResult(payload) {
	if (payload.error) {
		const error = new Error(payload.error.message);
		error.code = payload.error.code;
		error.data = payload.error.data;
		throw error;
	}
	return payload.result;
}
const alchemyProvider0b2e9f09 = /* @__PURE__ */ Object.freeze(
	/* @__PURE__ */ Object.defineProperty(
		{
			__proto__: null,
			AlchemyProvider,
		},
		Symbol.toStringTag,
		{ value: 'Module' },
	),
);
export { AlchemyProvider as A, JsonRpcProvider as J, alchemyProvider0b2e9f09 as a, defineReadOnly as d, getNetwork as g, version as v };
