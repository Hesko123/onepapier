import Purchases from 'react-native-purchases';
import { ENTITLEMENT_ID } from '../config';

export async function checkPremium() {
  try {
    const info = await Purchases.getCustomerInfo();
    return !!info.entitlements.active[ENTITLEMENT_ID] ||
      Object.keys(info.entitlements.active).length > 0 ||
      !!info.activeSubscriptions?.length;
  } catch {
    return false;
  }
}

export async function getOfferings() {
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.all['OnePapier Pro'] ?? offerings.current ?? null;
  } catch {
    return null;
  }
}

export async function purchasePackage(pkg) {
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  // Une fois les produits liés à l'entitlement dans RevenueCat, utiliser :
  // return !!customerInfo.entitlements.active[ENTITLEMENT_ID];
  return !!customerInfo.entitlements.active[ENTITLEMENT_ID] ||
    Object.keys(customerInfo.entitlements.active).length > 0 ||
    !!customerInfo.activeSubscriptions?.length;
}

export async function restorePurchases() {
  try {
    const info = await Purchases.restorePurchases();
    return !!info.entitlements.active[ENTITLEMENT_ID];
  } catch {
    return false;
  }
}
