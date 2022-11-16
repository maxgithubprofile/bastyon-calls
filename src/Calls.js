import {EventEmitter} from 'events';
import "./scss/index.sass";

class BastyonCalls extends EventEmitter {

	constructor(client, matrixcs, root, options){
		super()
		this.client = client;
		this.matrixcs = matrixcs;
		this.initEvents()
		this.initTemplates(root)
		this.options = options
	}

	controls = {}
	isFrontalCamera = false
	videoStreams = null
	isMuted = false
	activeCall = null
	secondCall = null
	isMuted = false
	syncInterval = null
	isWaitingForConnect = false

	templates = {
		incomingCall : function(){
			return `
			<div class="bc-incoming-call">
				<div class="user">
					<div class="avatar">
						${this.getAvatar()}
					</div>
					<div class="title">
						<div class="name">${this.activeCall.initiator.name}</div>
						<div class="description">Входящий звонок</div>
					</div>
				</div>
				<div class="buttons">
					<button class="bc-btn bc-decline" id="bc-decline"><i class="fas fa-phone"></i></button>
					<button class="bc-btn bc-answer" id="bc-answer"><i class="fas fa-phone"></i></button>
				</div>
			</div>
		`
		},
		endedCall : function(call){
			return `	
			<div class="bc-ended-call">
				<div class="avatar">
						${this.getAvatar()}
				</div>
				<div class="name">${this.activeCall.initiator.name}</div>
				<div class="description">Звонок завершен</div>
			</div>`
		},

		videoCall : function(){
			return `
			<div class="bc-topnav">
				<div class="bc-call-info">
					<div class="time" id="time">12:02</div>
					<div class="name">${this.activeCall.initiator.name}</div>
				</div>
				<div class="options">
					<button class="bc-btn bc-cog" id="bc-cog"><i class="fas fa-cog"></i></button>
					<button class="bc-btn bc-pip" id="bc-pip"><i class="fas fa-images"></i></button>
					<button class="bc-btn bc-format" id="bc-format"><i class="fas"></i></button>
				</div>	
			</div>
			<div class="bc-video-container">
				<div class="bc-video active novid" id="remote-scene">
					<video id="remote" pip="false" autoplay playsinline ></video>
					<div class="avatar">${this.getAvatar()}</div>
				</div>
				<div class="bc-video minified">
					<video id="local" pip="false" autoplay playsinline ></video>
				</div>
			</div>
			<div class="bc-controls">
				<button class="bc-btn bc-camera" id="bc-camera"><i class="fas fa-sync-alt"></i></button>
				<button class="bc-btn bc-hide" id="bc-hide"><i class="fas fa-video"></i></button>
				<button class="bc-btn bc-mute" id="bc-mute"><i class="fas fa-microphone"></i></button>
				<button class="bc-btn bc-decline" id="bc-decline"><i class="fas fa-phone"></i></button>
				<button class="bc-btn bc-expand" id="bc-expand"><i class="fas fa-expand"></i></button>
			</div>
		`
		}

	}

	renderTemplates = {

		videoCall : () => {
			console.log('videoCall')
			this.root.classList.add('middle')
			// this.root.classList.add('active')
			this.root.innerHTML = this.templates['videoCall']?.call(this) || ''
			this.initCallInterface('videoCall')
		},
		incomingCall: (call) => {
			this.root.classList.remove('middle')
			this.notify.innerHTML = this.templates['incomingCall']?.call(this) || ''
			this.initCallInterface('incomingCall', call)
		},
		clearNotify : () => {
			console.log('clearNotify')
			this.notify.innerHTML = ''
		},
		clearVideo : () => {
			console.log('clearVideo')
			this.root.innerHTML = ''
		},
		clearInterface : () => {
			console.log('clearInterface')
			this.root.classList.remove('active')
			this.root.classList.remove('minified')
			this.root.classList.remove('middle')
			this.root.classList.remove('full')
		},
		endedCall : (call) => {
			console.log('endedCall')
			this.root.innerHTML = this.templates['endedCall']?.call(this,call) || ''
		}
	}

	initTemplates(outerRoot){
		outerRoot.insertAdjacentHTML('beforeend', `<div class="bc-container"><div id="bc-notify" class="bc-notify"></div><div id="bc-root"></div></div>`);
		this.root = document.getElementById('bc-root')
		this.notify = document.getElementById('bc-notify')
		if (window) {
			console.log('проверка закрывашки')
			window.onunload = () => {
				if(this.activeCall) {
					this.activeCall.hangup()
				}
			}
		}
	}


	initEvents(){
		this.client.on("Call.incoming", async (call) => {
			debugger
			let members = this.client.store.rooms[ call.roomId ].currentState.members
			let initiatorId = Object.keys(members).filter(m => m !== this.client.credentials.userId)
			let initiator = members[ initiatorId ]
			let user = members[this.client.credentials.userId]

			call.initiator = initiator
			call.user = user
			console.log('перед', this)
			this.options.getUserInfo([initiator.userId]).then((res) => {


				 initiator.source = res[0]
				 this.addCallListeners(call)
				 if (!this.activeCall) {
					 this.activeCall = call
				 } else if(!this.secondCall){
					 this.secondCall = call
					 console.log('новый звонок в очереди', call)
				 } else {
					 call.reject('занято')
				 }
				this.renderTemplates.incomingCall(call)
			 })


		});


	}

	answer(){
		try {
			if (this.activeCall.state === "ringing") {
				this.activeCall.answer()
				console.log('Ответ на',this.activeCall)
				console.log('remote tracks', this.activeCall.remoteStream.getTracks())

				console.log('remote senders', this.activeCall.peerConn.getSenders())
				this.renderTemplates.clearNotify()
				this.renderTemplates.videoCall()
			} else {
				this.isWaitingForConnect = true
				this.renderTemplates.clearNotify()
				this.activeCall.hangup()
				setTimeout(()=> {
					try {
						console.log('Сброс + ответ на', this.activeCall)
						this.activeCall.answer()
						this.isWaitingForConnect = false
						this.renderTemplates.videoCall()
					} catch (e) {
						console.log("Ошибка при ответе на вторую линию", e)
					}
				}, 1000)
			}

		} catch (e) {
			// this.renderTemplates.clearNotify()
			// this.renderTemplates.clearVideo()
			// this.renderTemplates.clearInterface()
			console.log('error answer',e)
		}
	}

	initsync() {
		let container = document.querySelector('.bc-video-container')
		this.syncInterval = setInterval(() => {
			if(this.root.classList.contains('minified')){
				console.log(this?.activeCall.remoteStream.getVideoTracks()[0].getSettings())
				let ratio = this?.activeCall.remoteStream.getVideoTracks()[0].getSettings().aspectRatio
				if (ratio){
					container.style.aspectRatio = ratio
					if (ratio < 1) {
						container.classList.add('vertical')
					} else {
						container.classList.remove('vertical')
					}
				}
			}
		},1000)
	}

	// play(e){
	// 	e.target.play().catch(console.log)
	// }

	mute(e){

		e.stopPropagation()

		let sender = this.activeCall.peerConn.getSenders().find((s) => {
			return s.track.kind === 'audio';
		})

		let control = document.querySelector('.bc-mute')
		if (sender.track.enabled) {
			control.firstChild.classList.remove('fa-microphone')
			control.classList.add('active')
			control.firstChild.classList.add('fa-microphone-slash')

		} else {
			control.firstChild.classList.remove('fa-microphone-slash')
			control.classList.remove('active')
			control.firstChild.classList.add('fa-microphone')
		}
		sender.track.enabled = !sender.track.enabled
	}

	hide(e){
		e.stopPropagation()
		let sender = this.activeCall.peerConn.getSenders().find((s) => {
			return s.track.kind === 'video';
		})

		let control = document.querySelector('.bc-hide')
		if (sender.track.enabled) {
			control.firstChild.classList.remove('fa-video')
			control.classList.add('active')
			control.firstChild.classList.add('fa-video-slash')
		} else {
			control.firstChild.classList.remove('fa-video-slash')
			control.classList.remove('active')
			control.firstChild.classList.add('fa-video')
		}
		sender.track.enabled = !sender.track.enabled

	}

	camera(e) {
		let self = this
		if (e) e.stopPropagation()

		try {
			navigator.mediaDevices.enumerateDevices().then( (dev) => {
				let video = dev.filter(d => d.kind === 'videoinput')
				let target
				const senders = self.activeCall.peerConn.getSenders()
				console.log('senders', senders)
				let sender = senders.find((s) => {
					return s.track.kind == 'video';
				})
				console.log('sender', sender)

				if (sender && sender?.label?.includes('front' || 'передней')){
					console.log('Используется фронтальная камера')
					self.isFrontalCamera = true
				}
				console.log('список видео', video)

				if (video.length > 1) {

					if (sender.track.label.includes('front') || sender.track.label.includes('передней')) {
						console.log('на заднюю')
						target = video.reverse().find((device) => {
							return device.label.includes('back') || device.label.includes('задней')
						})
					} else {
						console.log('на переднюю')
						target = video.find((device) => {
							return device.label.includes('front') || device.label.includes('передней')
						})
					}
					console.log('fft',target)



				} else return

				let videoConstraints = {}
				videoConstraints.deviceId = { exact: target.deviceId }

				const constraints = {
					video: videoConstraints,
					audio: false
				};
				navigator.mediaDevices
				  .getUserMedia(constraints)
				  .then(stream => {
					  console.log(stream.getTracks())
					  stream.getTracks().forEach(function(track) {
						  console.log('track', track)
						  const sender = self.activeCall.peerConn.getSenders().find((s) => {
							  return s.track.kind == track.kind;
						  })
						  console.log('текущий видеострим ', sender)
						  if (sender.track.label === track.label) {
							  console.log('одинаковый стрим')
							  return
						  }
						  if (track.muted) {
							  console.log('Трек не доступен', track)
						  }
						  console.log('новый видео тре', track)
						  sender.replaceTrack(track);
						  self.videoStreams.local.srcObject = stream
						  console.log(self.videoStreams.local.srcObject)
					  })
				  }).catch(function(error) {

					console.log("Const stream: " + error.message);
				})

			}).catch(function(error) {

				console.log( "Check: " + error.message);
			})
		} catch (e) {

			console.log('sa',e)
		}

	}

	format() {
		if (this.root.classList.contains('middle')) {
			this.root.classList.remove('middle')
			this.root.classList.add('full')
		} else if (this.root.classList.contains('full')) {
			this.root.classList.remove('full')
			this.root.classList.add('middle')
		}
	}
	pip() {
		if (this.root.classList.contains('middle')) {
			this.root.classList.remove('middle')
			this.root.classList.add('minified')
		} else if (this.root.classList.contains('full')) {
			this.root.classList.remove('full')
			this.root.classList.add('minified')
		} else {
			this.syncInterval = null
			this.root.classList.remove('minified')
			this.root.classList.add('middle')
		}
	}

	async initCall(roomId){
		console.log('Вызов')
		try {
			const constraints = {
				video : true
			}
			let stream = await navigator.mediaDevices.getUserMedia(constraints)
			console.log('проверил')
		} catch (e) {
			console.log('нет доступа к медиа',e)
			return
		}



		const call = matrixcs.createNewMatrixCall(this.client, roomId)
		if (!this.activeCall) {
			this.activeCall = call
		} else {
			console.log('У вас есть активный звонок')
			return
		}
		call.placeVideoCall(document.getElementById("remote"),document.getElementById("local"))

		let members = this.client.store.rooms[ call.roomId ].currentState.members
		let initiatorId = Object.keys(members).filter(m => m !== this.client.credentials.userId)
		let initiator = members[ initiatorId ]
		let user = members[this.client.credentials.userId]

		call.initiator = initiator
		call.user = user

		initiator.source = await this.options.getUserInfo([initiator.userId])[0]

		this.options.getUserInfo([initiator.userId]).then((res) => {
			initiator.source = res[0]

			this.addCallListeners(call)

			this.renderTemplates.videoCall()
		}).catch(e => console.log(e))



		return call
	}

	hexDecode(hex) {
		var ch = 0;
		var result = "";
		for (var i = 2; i <= hex.length; i += 2) {
			ch = parseInt(hex.substring(i - 2, i), 16);
			if (ch >= 128) ch += 0x350;
			ch = String.fromCharCode("0x" + ch.toString(16));
			result += ch;
		}
		return result;
	}

	hangup(e){
		e.stopPropagation()
		this.activeCall.hangup('ended', false)
		this.renderTemplates.clearVideo()
		console.log('hangup')
	}

	reject(call){
		call.reject()
	}

	// changeView(event){
	// 	if(this.root.classList.contains('minified')){
	// 		this.minimize()
	// 		return
	// 	}
	// }

	initCallInterface(type, call){

		switch (type) {
			case 'incomingCall':
				document.getElementById("bc-answer").addEventListener('click', this.answer.bind(this))
				document.getElementById("bc-decline").addEventListener('click', () => this.reject(call))
				break;
			case 'videoCall':
				this.videoStreams = {
					remote : document.getElementById("remote"),
					local : document.getElementById("local")
				}
				try {
					this.activeCall.setLocalVideoElement(this.videoStreams.local)
					this.activeCall.setRemoteVideoElement(this.videoStreams.remote)
					this.addVideoInterfaceListeners()
					console.log('стримы',this.videoStreams)
				} catch (e) {
					console.log('init interface',e)
				}
				break;
		}
	}

	addVideoInterfaceListeners(){
		// this.videoStreams.local.addEventListener('click', (e) => this.changeView.call(this, e))
		this.videoStreams.remote.addEventListener('click', (e) => this.pip.call(this, e))
		document.getElementById("bc-decline").addEventListener('click', (e) => this.hangup.call(this,e))
		document.getElementById("bc-mute").addEventListener('click', (e) => this.mute.call(this,e))
		document.getElementById("bc-hide").addEventListener('click', (e) => this.hide.call(this,e))
		document.getElementById("bc-camera").addEventListener('click', (e) => this.camera.call(this,e))
		document.getElementById("bc-expand").addEventListener('click', (e) => this.pip.call(this,e))
		document.getElementById("bc-cog").addEventListener('click', (e) => this.settings.call(this,e))
		document.getElementById("bc-format").addEventListener('click', (e) => this.format.call(this,e))
		document.getElementById("bc-pip").addEventListener('click', (e) => this.pip.call(this,e))
		// this.root.addEventListener('click',(e) => this.play.call(this,e))


	}

	addCallListeners(call){

		call.on('state', (a,b) => {
			if (a === 'connected') {
				this.showRemoteVideo()
				this.initsync()
			}
			if (a === 'ended') {
				this.syncInterval = null
			}
		})
		call.on("hangup", (call) => {
			console.log('Звонок окончен',this)
			if (!call) {
				this.renderTemplates.clearNotify()
			}
			if (call.callId === this.secondCall?.callId) {
				this.secondCall = null
				this.renderTemplates.clearNotify()
				console.log('Вторая линия сброшена', call)
			}
			if (call.callId === this.activeCall?.callId) {

				console.log('Первая линия сброшена', call)

				if(this.isWaitingForConnect) {
					this.activeCall = this.secondCall
					this.secondCall = null
					console.log('вторая линия стала первой', this.activeCall)
					return;
				}
				this.renderTemplates.clearVideo()
				this.renderTemplates.clearNotify()
				if (call.hangupParty === "local" || call.localVideoElement) {
					this.renderTemplates.endedCall(call)
					setTimeout(() => {
						this.renderTemplates.clearVideo()
						this.renderTemplates.clearInterface()
						this.activeCall = null
					}, 2000)
					return
				}
				this.renderTemplates.clearInterface()

			}


		});
		call.on("error", function(err){
			this.renderTemplates.clearVideo()
			console.log('Ошибка в звонке',err)
			this.lastError = err.message;
			call.hangup('error');

			this.emit('error', err)
		});
	}


	getAvatar() {
		console.log('avatar',this)
		if(this.activeCall.initiator?.source?.image){
			return `<img src="${this.activeCall.initiator.source.image}"/>`
		}
		return this.activeCall.initiator.name[0].toUpperCase()
	}

	showRemoteVideo() {
		document.getElementById('remote-scene').classList.remove('novid')
	}

}

window.BastyonCalls = BastyonCalls
export default BastyonCalls