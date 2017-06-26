/* global define, WeixinJSBridge */
(function jWeixin(window, initFunc) {
  if (typeof define === 'function' && (define.amd || define.cmd)) {
    define(function () {
      return initFunc(window)
    })
  } else {
    initFunc(window, true)
  }
})(this, function (win, notModule) {

  function invoke(methodName, data, config) { // invoke method by WeixinBridge.invoke
    if (win.WeixinJSBridge) {
      WeixinJSBridge.invoke(methodName, addVerfiyInfo(data), function (result) {
        handleNativeResult(methodName, result, config)
      })
    } else {
      log(methodName, config) // when there is no WeixinJSBridge on window, just log it
    }
  }

  function registerCallback(methodName, data, config) { // register callback by WeixinBridge.on
    if (win.WeixinJSBridge) {
      WeixinJSBridge.on(methodName, function (result) {
        if (config && config.trigger) {
          config.trigger(result)
        }
        handleNativeResult(methodName, result, data)
      })
    } else {
      if (config) {
        log(methodName, config)
      } else {
        log(methodName, data)
      }
    }
  }

  function addVerfiyInfo(config) { // every invoke must have these verify info
    config = config || {}
    config.appId = OPTIONS.appId
    config.verifyAppId = OPTIONS.appId
    config.verifySignType = 'sha1'
    config.verifyTimestamp = OPTIONS.timestamp + ''
    config.verifyNonceStr = OPTIONS.nonceStr
    config.verifySignature = OPTIONS.signature

    return config
  }

  function addPaymentInfo(data) { // ralated with chooseWXPay and openEnterpriseRedPacket, notice the paySign property
    return {
      timestamp: data.timestamp + '',
      nonceStr: data.nonceStr,
      package: data.package,
      paySign: data.paySign,
      signType: data.signType || 'SHA1'
    }
  }

  function normalizeAddress(address) { // for user address info, concerning compatibility.
    address.postalCode = address.addressPostalCode
    delete address.addressPostalCode

    address.provinceName = address.proviceFirstStageName // provice => province? typo
    delete address.proviceFirstStageName

    address.cityName = address.addressCitySecondStageName
    delete address.addressCitySecondStageName

    address.countryName = address.addressCountiesThirdStageName // count => country, for i18n?
    delete address.addressCountiesThirdStageName

    address.detailInfo = address.addressDetailInfo
    delete address.addressDetailInfo

    return address
  }

  function handleNativeResult(methodName, result, config) {
    if (methodName === 'openEnterpriseChat') {
      result.errCode = result.err_code
    }
    delete result.err_code
    delete result.err_desc
    delete result.err_detail

    let errMsg = result.errMsg

    if (!errMsg) {
      errMsg = result.err_msg
      delete result.err_msg
      errMsg = normalizeErrMsg(methodName, errMsg)
      result.errMsg = errMsg
      config = config || {}
      if (config._complete) { // call result handler, usually for result normalizing(native to js, str to obj etc.)
        config._complete(result)
        delete config._complete
      }
      errMsg = result.errMsg || ''
      if (OPTIONS.debug && !config.isInnerInvoke) { // alert when is DEBUG mode, like official site's example
        alert(JSON.stringify(result))
      }
    }

    const index = errMsg.indexOf(':')
    const RESULT_TOKEN = errMsg.substring(index + 1)

    switch (RESULT_TOKEN) { // call real callbacks from user's config.
      case 'ok':
        config.success && config.success(result)
        break
      case 'cancel':
        config.cancel && config.cancel(result)
      default:
        config.fail && config.fail(result)
    }
    config.complete && config.complete(result)
  }

  function normalizeErrMsg(methodName, errMsg) { // normalize native messages to uniformed messege pattern
    const name = methodName
    const command = commandNameMap[name]

    if (command) {
      name = command
    }

    let resultStr = 'ok'

    if (errMsg) {
      const index = errMsg.indexOf(':')

      resultStr = errMsg.substring(index + 1)

      if (resultStr === 'confirm') {
        resultStr = 'ok'
      }

      if (resultStr === 'failed') {
        resultStr = 'fail'
      }

      if (resultStr.indexOf('failed_') != -1) {
        resultStr = resultStr.substring(7)
      }
      if (resultStr.indexOf('fail_') != -1) {
        resultStr = resultStr.substring(5)
      }

      resultStr = resultStr.replace(/_/g, ' ')
      resultStr = resultStr.toLowerCase()

      if (resultStr === 'access denied' || resultStr === 'no permission to execute') {
        resultStr = 'permission denied'
      }

      if (name == 'config' && resultStr === 'function not exist') {
        resultStr = 'ok'
      }

      if (resultStr == '') {
        resultStr = 'fail'
      }

      errMsg = name + ':' + resultStr

      return errMsg
    }

  }

  function removeNonAllowedApis(apiList) { // only check allowed apis
    if (apiList) {
      for (let i = 0, l = apiList.length; i < l; i++) {
        const api = apiList[i]
        const methodName = methodNameMap[api]

        if (methodName) {
          apiList[i] = methodName
        }
      }
      return apiList
    }
  }

  function log(name, config) { // log method calling in DEBUG mode
    if (OPTIONS.debug && !(config && config.isInnerInvoke)) {
      const commandName = commandNameMap[name]

      if (commandName) {
        name = commandName
      }

      if (config && config._complete) {
        delete config._complete
      }

      console.log('"' + name + '",', config || '')
    }
  }

  function sendTrackInfo() {
    if (!isPC && !isDebugger && !OPTIONS.Debug && clientVersion <= '6.0.2' && clientInfo.systemType >= 0) {
      let tracker = new Image()

      clientInfo.appId = OPTIONS.appId
      clientInfo.initTime = perfermance.initEndTime - perfermance.initStartTime
      clientInfo.preVerifyTime = perfermance.preVerifyEndTime - perfermance.preVerifyStartTime

      wx.getNetworkType({
        isInnerInvoke: true,
        success: function (result) {
          clientInfo.networkType = result.networkType
          const url = 'https://open.weixin.qq.com/sdk/report?v=' + clientInfo.version + '&o=' + clientInfo.isPreVerifyOk + '&s=' + clientInfo.systemType + '&c=' + clientInfo.clientVersion + '&a=' + clientInfo.appId + '&n=' + clientInfo.networkType + '&i=' + clientInfo.initTime + '&p=' + clientInfo.preVerifyTime + '&u=' + clientInfo.url

          tracker.src = url
        }
      })
    }
  }

  function getTimestamp() {
    return (new Date()).getTime()
  }

  function ensureBridgeReady(cb) {
    if (isInWechat) {
      if (win.WeixinJSBridge) {
        cb()
      } else {
        if (doc.addEventListener) {
          doc.addEventListener('WeixinJSBridgeReady', cb, false)
        }
      }
    }
  }

  function registerInvokeAndOn() { // used for beta features like launch3rdApp, it calls wx.invoke directly
    if (wx.invoke === undefined) {
      wx.invoke = function (methodName, config, callback) {
        win.WeixinJSBridge && WeixinJSBridge.invoke(methodName, normalizeConfig(config), callback)
      }
      wx.on = function (methodName, config) {
        win.WeixinJSBridge && WeixinJSBridge.on(methodName, config)
      }
    }
  }

  if (!win.jWeixin) {
    const methodNameMap = {
      config: 'preVerifyJSAPI',
      onMenuShareTimeline: 'menu:share:timeline',
      onMenuShareAppMessage: 'menu:share:appmessage',
      onMenuShareQQ: 'menu:share:qq',
      onMenuShareWeibo: 'menu:share:weiboApp',
      onMenuShareQZone: 'menu:share:QZone',
      previewImage: 'imagePreview',
      getLocation: 'geoLocation',
      openProductSpecificView: 'openProductViewWithPid',
      addCard: 'batchAddCard',
      openCard: 'batchViewCard',
      chooseWXPay: 'getBrandWCPayRequest',
      openEnterpriseRedPacket: 'getRecevieBizHongBaoRequest',
      startSearchBeacons: 'startMonitoringBeacons',
      stopSearchBeacons: 'stopMonitoringBeacons',
      onSearchBeacons: 'onBeaconsInRange',
      consumeAndShareCard: 'consumedShareCard',
      openAddress: 'editAddress'
    }

    const commandNameMap = (function () {
      let map = {}

      for (let name in methodNameMap) {
        map[methodNameMap[name]] = name
      }
      return map
    })()

    const doc = win.document
    const pageTitle = win.title
    const ua = navigator.userAgent.toLowerCase()
    const platform = navigator.platform.toLowerCase()
    const isPC = platform.match('mac') || ua.match('win')
    const isDebugger = ua.indexOf('wxdebugger') != -1 // for wechat development toolkits
    const isInWechat = ua.indexOf('micromessenger') != -1
    const isAndroid = ua.indexOf('android') != -1
    const isiOS = ua.indexOf('iphone') != -1 || ua.indexOf('ipad') != -1

    const clientVersion = (function () {
      const matched = ua.match(/micromessenger\/(\d+\.\d+\.\d+)/) || ua.match(/micromessenger\/(\d+\.\d+)/)

      return matched ? matched[1] : ''
    })()

    let perfermance = { // track code performance
      initStartTime: getTimestamp(),
      initEndTime: 0,
      preVerifyStartTime: 0,
      preVerifyEndTime: 0
    }

    let clientInfo = {
      version: 1,
      appId: '',
      initTime: 0,
      preVerifyTime: 0,
      networkType: '',
      isPreVerifyOk: 1,
      systemType: isiOS ? 1 : isAndroid ? 2 : -1,
      clientVersion: clientVersion,
      url: encodeURIComponent(location.href)
    }

    let OPTIONS = {} // options that user passed in through wx.config
    let callbackManager = {
      _completes: []
    }

    let bridgeState = {
      state: 0, // 0 for not ready, 1 for ready
      data: {}
    }

    ensureBridgeReady(function () {
      // record init time first
      perfermance.initEndTime = getTimestamp()
    })

    let isBlocked = false
    let localImageLoadQueue = []

    const wx = {
      config: function (opts) {
        OPTIONS = opts
        log('config', opts)

        const needCheck = !!OPTIONS.check // this should be a flag for developing

        ensureBridgeReady(function () {
          if (needCheck) { // will check all APIs available
            invoke(
              methodNameMap.config,
              { verifyJSApiList: removeNonAllowedApis(OPTIONS.jsApiList) },
              (function () {
                callbackManager._complete = function (data) {
                  perfermance.preVerifyEndTime = getTimestamp()
                  bridgeState.state = 1
                  bridgeState.data = data
                }
                callbackManager.success = function (data) {
                  clientInfo.isPreVerifyOk = 0
                }
                callbackManager.fail = function (data) {
                  callbackManager._fail ? callbackManager._fail(data) : (bridgeState.state = -1)
                }

                let callbacks = callbackManager._completes

                callbacks.push(function () { // send all info back
                  sendTrackInfo()
                })

                callbackManager.complete = function () {
                  for (let i = 0, l = callbacks.length; i < l; i++) {
                    callbacks[i]() // then callbacks
                  }
                  callbackManager._completes = []
                }
                return callbackManager
              })()
            )
            perfermance.preVerifyStartTime = getTimestamp()
          } else {
            bridgeState.state = 1
            let callbacks = callbackManager._completes

            for (let i = 0, l = callbacks.length; i < l; i++) {
              callbacks[i]() // where all wx.ready callbacks called
            }
            callbackManager._completes = []
          }
        })
        if (OPTIONS.beta) {
          registerInvokeAndOn() // for beta features
        }
      },
      ready: function (callback) {
        if (bridgeState.state == 1) {
          callback()
        } else {
          callbackManager._completes.push(callback) // push it to callback queue, when bridge is not ready

          if (!isInWechat && OPTIONS.debug) { // when not in wechat, call it directly with debug mode
            callback()
          }
        }
      },
      error: function (callback) {
        if (clientVersion <= '6.0.2') {
          bridgeState.state == -1 ? callback(bridgeState.data) : callbackManager._fail = callback
        }
      },
      checkJsApi: function (config) {
        let normalizeResult = function (result) { // replace methodName to commandName
          let resultObj = result.checkResult

          for (let key in resultObj) {
            let commandName = commandNameMap[key]

            if (commandName) {
              resultObj[commandName] = resultObj[key]
              delete resultObj[key]
            }
          }
          return result
        }

        invoke(
          'checkJsApi',
          removeNonAllowedApis(config.jsApiList),
          (function () {
            config._complete = function (result) {
              if (isAndroid) { // android only result JSON string
                const resultStr = result.checkResult

                if (resultStr) {
                  result.checkResult = JSON.parse(resultStr)
                }
                result = normalizeResult(result)
              }
            }
            return config
          })()
        )
      },
      onMenuShareTimeline: function (config) {
        registerCallback(
          methodNameMap.onMenuShareTimeline,
          {
            complete: function () {
              invoke(
                'shareTimeline',
                {
                  title: config.title || pageTitle,
                  desc: config.title || pageTitle,
                  img_url: config.imgUrl || '',
                  link: config.link || location.href,
                  type: config.type || 'link',
                  data_url: config.dataUrl || ''
                },
                config
              )
            }
          },
          config
        )
      },
      onMenuShareAppMessage: function (config) {
        registerCallback(
          methodNameMap.onMenuShareAppMessage,
          {
            complete: function () {
              invoke(
                'shareAppMessage',
                {
                  title: config.title || pageTitle,
                  desc: config.title || '',
                  img_url: config.imgUrl || '',
                  link: config.link || location.href,
                  type: config.type || 'link',
                  data_url: config.dataUrl || ''
                },
                config
              )
            }
          },
          config
        )
      },
      onMenuShareQQ: function (config) {
        registerCallback(
          methodNameMap.onMenuShareQQ,
          {
            complete: function () {
              invoke(
                'shareQQ',
                {
                  title: config.title || pageTitle,
                  desc: config.title || '',
                  img_url: config.imgUrl || '',
                  link: config.link || location.href,
                },
                config
              )
            }
          },
          config
        )
      },
      onMenuShareWeibo: function (config) {
        registerCallback(
          methodNameMap.onMenuShareWeibo,
          {
            complete: function () {
              invoke(
                'shareWeiboApp',
                {
                  title: config.title || pageTitle,
                  desc: config.title || '',
                  img_url: config.imgUrl || '',
                  link: config.link || location.href,
                },
                config
              )
            }
          },
          config
        )
      },
      onMenuShareQZone: function (config) {
        registerCallback(
          methodNameMap.onMenuShareQZone,
          {
            complete: function () {
              invoke(
                'shareQZone',
                {
                  title: config.title || pageTitle,
                  desc: config.title || '',
                  img_url: config.imgUrl || '',
                  link: config.link || location.href,
                },
                config
              )
            }
          },
          config
        )
      },
      startRecord: function (config) {
        invoke('startRecord', {}, config)
      },
      stopRecord: function (config) {
        invoke('stopRecord', {}, config)
      },
      onVoiceRecordEnd: function (config) {
        registerCallback('onVoiceRecordEnd', config)
      },
      playVoice: function (config) {
        invoke('playVoice', { localId: config.localId }, config)
      },
      pauseVoice: function (config) {
        invoke('pauseVoice', { localId: config.localId }, config)
      },
      stopVoice: function (config) {
        invoke('stopVoice', { localId: config.localId }, config)
      },
      onVoicePlayEnd: function (config) {
        registerCallback('onVoicePlayEnd', config)
      },
      uploadVoice: function (config) {
        invoke(
          'uploadVoice',
          {
            localId: config.localId,
            isShowProgressTips: !!config.isShowProgressTips
          },
          config
        )
      },
      downloadVoice: function (config) {
        invoke(
          'downloadVoice',
          {
            serverId: config.serverId,
            isShowProgressTips: !!config.isShowProgressTips
          },
          config
        )
      },
      downloadVoice: function (config) {
        invoke(
          'downloadVoice',
          {
            serverId: config.serverId,
            isShowProgressTips: !!config.isShowProgressTips
          },
          config
        )
      },
      translateVoice: function (config) {
        invoke(
          'translateVoice',
          {
            localId: config.localId,
            isShowProgressTips: !!config.isShowProgressTips
          },
          config
        )
      },
      chooseImage: function (config) {
        invoke(
          'chooseImage',
          {
            scene: '1|2',
            count: config.count || 9,
            sizeType: config.sizeType || ['original', 'compressed'],
            sourceType: config.sourceType || ['album', 'camera']
          },
          (function () {
            config._complete = function (result) {
              if (isAndroid) {
                const idStr = result.localIds

                if (idStr) {
                  result.localIds = JSON.parse(idStr)
                }
              }
            }
            return config
          })()
        )
      },
      getLocation: function (config) {}, // this should be code error
      previewImage: function (config) {
        invoke(
          methodNameMap.previewImage,
          {
            current: config.current,
            urls: config.urls
          },
          config
        )
      },
      uploadImage: function (config) {
        invoke(
          'uploadImage',
          {
            localId: config.localId,
            isShowProgressTips: !!config.isShowProgressTips
          },
          config
        )
      },
      downloadImage: function (config) {
        invoke(
          'downloadImage',
          {
            serverId: config.serverId,
            isShowProgressTips: !!config.isShowProgressTips
          },
          config
        )
      },
      getLocalImageData: function (config) {
        if (isBlocked === false) {
          isBlocked = !isBlocked

          invoke(
            'getLocalImageData',
            { localId: config.localId },
            (function () {
              config._complete = function (result) {
                isLoading = !isLoading
                if (localImageLoadQueue.length > 0) {
                  const imgConfig = localImageLoadQueue.shift()

                  wx.getLocalImageData(imgConfig)
                }
              }
              return config
            })()
          )
        } else {
          localImageLoadQueue.push(config)
        }
      },
      getNetworkType: function (config) {
        let normalizeResult = function (result) {
          const errMsg = result.errMsg

          result.errMsg = 'getNetworkType:ok'
          const type = result.subtype

          delete result.subtype

          if (type) {
            result.networkType = type
          } else {
            const index = errMsg.indexOf(':')
            const RESULT_TOKEN = errMsg.substring(index + 1)

            switch (RESULT_TOKEN) {
              case 'wifi':
              case 'edge':
              case 'wwan':
                result.networkType = RESULT_TOKEN
                break
              default:
                result.errMsg = 'getNetworkType:fail'
            }
            return result
          }
        }

        invoke('getNetworkType', {}, (function () {
          config._complete = function (result) {
            result = normalizeResult(result)
          }
          return cofnig
        })())
      },
      openLocation: function (config) {
        invoke('openLocation', {
            latitude: config.latitude,
            longitude: config.longitude,
            name: config.name || '',
            address: config.address || '',
            scale: config.scale || 28,
            infoUrl: config.infoUrl || ''
        },
               config)
      },
      getLocation: function (config) {
        config = config || {}
        invoke(
          methodNameMap.getLocation,
          {
            type: config.type || 'wgs84'
          },
          (function () {
            config._complete = function (result) {
              delete result.type
            }
            return config
          })()
        )
      },
      hideOptionMenu: function (config) {
        invoke('hideOptionMenu', {}, config)
      },
      showOptionMenu: function (config) {
        invoke('showOptionMenu', {}, config)
      },
      closeWindow: function (config) {
        config = config || {}
        invoke('closeWindow', {}, config)
      },
      hideMenuItems: function (config) {
        invoke('hideMenuItems', { menuList: config.menuList }, config)
      },
      showMenuItems: function (config) {
        invoke('showMenuItems', { menuList: config.menuList }, config)
      },
      hideAllNonBaseMenuItem: function (config) {
        invoke('hideAllNonBaseMenuItem', {}, config)
      },
      showAllNonBaseMenuItem: function (config) {
        invoke('showAllNonBaseMenuItem', {}, config)
      },
      scanQRCode: function (config) {
        config = config || {}
        invoke('scanQRCode', {
            needResult: config.needResult || 0,
            scanType: config.scanType || ['qrCode', 'barCode']
        },
               (function () {
                 config._complete = function (result) {
                   if (isiOS) { // now iOS needs a special care
                     const resultStr = result.resultStr

                     if (resultStr) {
                       const res = JSON.parse(resultStr)

                       result.resultStr = res && res.scan_code && res.scan_code.scan_result
                     }
                   }
                 }
                 return config
               })()
        )
      },
      openAddress: function (config) {
        invoke(methodNameMap.openAddress, {},
               (function () {
                 config._complete = function (result) {
                   result = normalizeAddress(result)
                 }
                 return config
               })()
        )
      },
      openProductSpecificView: function (config) {
        invoke(methodNameMap.openProductSpecificView, {
            pid: config.productId,
            view_type: config.viewType || 0,
            ext_info: config.extInfo
        },
               config)
      },
      addCard: function (config) {
        const cardList = config.cardList
        let cards = []

        for (let i = 0, l = cardList.length; i < l; i++) {
          const card = cardList[i]
          const cardInfo = {
            card_id: card.cardId,
            card_ext: card.cardExt
          }

          cards.push(cardInfo)
        }

        invoke(methodNameMap.addCard, { card_list: cards },
               (function () {
                 config._complete = function (result) {
                   let cards = result.card_list

                   if (cards) {
                     cards = JSON.parse(cards)
                     for (let i = 0, l = cards.length; i < l; i++) {
                       let card = cards[i]

                       card.cardId = card.card_id
                       card.cardExt = card.card_ext
                       card.isSuccess = !!card.is_succ

                       delete card.card_id
                       delete card.card_ext
                       delete card.is_succ
                     }
                     result.cardList = cards
                     delete result.card_list
                   }
                 }
                 return config
               })()
        )
      },
      chooseCard: function (config) {
        invoke('chooseCard', {
            app_id: OPTIONS.appId,
            location_id: config.shopId || '',
            sign_type: config.signType || 'SHA1',
            card_id: config.cardId || '',
            card_type: config.cardType || '',
            card_sign: config.cardSign,
            time_stamp: config.timestamp + '',
            nonce_str: config.nonceStr
        },
               (function () {
                 config._complete = function (result) {
                   result.cardList = result.choose_card_info
                   delete result.choose_card_info
                 }
                 return config
               })()
        )
      },
      openCard: function (config) {
        const cardList = config.cardList
        const cards = []

        for (let i = 0, l = cardList.length; i < l; i++) {
          const card = cardList[i]
          const cardInfo = {
            card_id: card.cardId,
            code: card.code
          }

          cards.push(cardInfo)
        }

        invoke(methodNameMap.openCard, { card_list: cards }, config)
      },
      consumeAndShareCard: function (config) { // a feature not listed on document
        invoke(methodNameMap.consumeAndShareCard, {
          consumeCardId: config.cardId,
          consumeCode: config.code
        }, config)
      },
      chooseWXPay: function (config) {
        invoke(methodNameMap.chooseWXPay, addPaymentInfo(config), config)
      },
      openEnterpriseRedPacket: function (config) { // a feature not listed on document
        invoke(methodNameMap.openEnterpriseRedPacket, addPaymentInfo(config), config)
      },
      startSearchBeacons: function (config) {
        invoke(methodNameMap.startSearchBeacons, { ticket: config.ticket }, config)
      },
      stopSearchBeacons: function (config) {
        invoke(methodNameMap.stopSearchBeacons, {}, config)
      },
      onSearchBeacons: function (config) {
        registerCallback(methodNameMap.onSearchBeacons, config)
      },
      openEnterpriseChat: function (config) { // a feature not listed on document
        invoke('openEnterpriseChat', {
          useridlist: config.userIds,
          chatname: config.groupName
        },
               config)
      }
    }

    // now let's deal with local resource loading

    let wxIdCount = 1 // for lcoal resource indexing
    let LOCAL_RESOURCES = {} // a resource represented as : key<string>: id, value<boolean>: loaded or not

    doc.addEventListener('error', function (e) {
      if (!isAndroid) { // it's iOS only
        const target = e.target
        const tagName = target.tagName
        const src = target.src

        if (tagName === 'IMG' || tagName === 'VIDEO' || tagName === 'AUDIO' || tagName === 'SOURCE') {
          const isLocalResource = src.indexOf('wxlocalresource://') != -1

          if (isLocalResource) {
            e.preventDefault()
            e.stopPropagation()

            let wxId = target['wx-id']

            if (!wxId) {
              wxId = wxIdCount++ // make every resource have a id
              target['wx-id'] = wxId
            }

            if (LOCAL_RESOURCES[wxId]) { // if it already loaded
              return
            }

            errors[wxId] = true // load it

            wx.ready(function () {
              wx.getLocalImageData({
                localId: src,
                success: function (result) {
                  target.src = result.localData
                }
              })
            })
          }
        }
      }
    }, true)

    doc.addEventListener('load', function (e) {
      if (!isAndroid) {
        const target = e.target
        const tagName = target.tagName

        if (tagName === 'IMG' || tagName === 'VIDEO' || tagName === 'AUDIO' || tagName === 'SOURCE') {
          const wxId = target['wx-id']

          if (wxId) {
            LOCAL_RESOURCES[wxId] = false // flag it to loaded
          }
        }
      }
    }, true)

    if (notModule) {
      win.wx = win.jWeixin = wx
    }

    return wx
  }
})
