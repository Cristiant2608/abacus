#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_MODULE(AbacusQuickAccess, RCTEventEmitter)
RCT_EXTERN_METHOD(setTemplates:(NSString *)json)
RCT_EXTERN_METHOD(consumeRequests:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
@end
