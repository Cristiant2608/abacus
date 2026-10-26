#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_MODULE(AbacusQuickAccess, RCTEventEmitter)
RCT_EXTERN_METHOD(openShortcuts:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(setTemplates:(NSString *)json)
RCT_EXTERN_METHOD(consumeRequests:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(claimSave:(NSString *)requestId resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(completeSave:(NSString *)requestId transactionId:(NSString *)transactionId errorMessage:(NSString *)errorMessage)
@end
