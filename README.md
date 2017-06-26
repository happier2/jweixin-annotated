# jWeixin annotated

How WeChat's JS-SDK works. Reverse engineering of [jWeixin](http://res.wx.qq.com/open/js/jweixin-1.2.0.js).

## Why

For all we known, WeChat is most popular social APP in China, and thousands of developers make thousands of interactive web pages depending on it's JS-SDK everyday.

But there is no detailed documentation about it's implementation, even a change log can't not be found, only a [doc](https://mp.weixin.qq.com/wiki?t=resource/res_main&id=mp1421141115) about how to use.

So I launch this project, for better known of how it works, and what have changed during it's iteration.

## File naming

all `.js` files would be named as `\d.\d.\d` or `\d.\d.\d.-annotated`, the nummeric-only ones stands for JS-SDK's original version, and ones with `-annotated` suffix for none-uglified and annotated.

## Version 1.2.0

The latest version of WeChat's JS-SDK.

### What we know from it

#### Added APIs:

 - consumeAndShareCard **undocumented**
 - openEnterpriseRedPacket **undocumented**
 - openEnterpriseChat **undocumented**
 - startSearchBeacons
 - stopSearchBeacons
 - onSearchBeacons
 - openAddress

#### Added feature: Local resources (iOS only)

iOS version loads local resources by callling wx.getLocalImageData, and Android should have native implementation for it.

#### fixed: wx.error would be called only once

#### update: clientInfo.preVerifyState => clientInfo.isPreVerifyOk

## Version 1.0.0

### What we know from it

#### OPTIONS.check for stats tracking

WeChat would track your clientInfo when passing true to options.checktrue during wx.config.


#### wx.error callback would be called only once


# License

Copyright (c) 2017 qiyuan-wang (AKA: zisasign)
Licensed under the MIT license.
