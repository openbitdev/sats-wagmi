import { Psbt } from 'bitcoinjs-lib';
import { isValidBTCAddress } from '@gobob/utils';

import { WalletNetwork } from '../types';

import { SatsConnector } from './base';

// function extractAccountNumber(path: string) {
//   const segments = path.split('/');
//   const accountNum = parseInt(segments[3].replaceAll("'", ''), 10);

//   if (isNaN(accountNum)) throw new Error('Cannot parse account number from path');

//   return accountNum;
// }

type AddressType = 'p2tr' | 'p2wpkh' | 'p2sh' | 'ethereum' | 'unknown';

type AddressResult = {
  address: string;
  publicKey?: string;
  tweakedPublicKey?: string;
  derivationPath?: string;
  isTestnet?: boolean;
  type: AddressType;
};

interface SignPsbtRequestParams {
  psbt: string;
  allowedSighash?: any[];
  signAtIndex: number | number[];
  network: any; // default is user's current network
  account: string; // default is user's current account
  broadcast?: boolean; // default is false - finalize/broadcast tx
}

type RequestAddressesResult = {
  result: {
    addresses: AddressResult[];
  };
};

type RequestAddressesFn = (method: 'getAddresses') => Promise<RequestAddressesResult>;
type RecipientParam = {
  address: string;
  amount: string;
};

type SendBTCFn = (
  method: 'sendTransfer',
  options: {
    account: string;
    recipients: RecipientParam[];
    network: WalletNetwork;
  }
) => Promise<string>;

type SignPsbtFn = (method: 'signPsbt', options: SignPsbtRequestParams) => Promise<{ psbt: string; txid?: string }>;

declare global {
  interface Window {
    OpenBitProvider: { request: RequestAddressesFn & SendBTCFn & SignPsbtFn };
  }
}

class OpenBitConnector extends SatsConnector {
  id = 'openbit';
  name = 'OpenBit';
  homepage = 'https://docs.openbit.app/';

  constructor(network: WalletNetwork) {
    super(network);
  }

  async connect(): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        const addressesResult = await window.OpenBitProvider.request('getAddresses');
        const account = addressesResult.result.addresses.find(
          (el) => el.type === 'p2tr' && !!el.isTestnet === (this.network === 'testnet')
        );

        if (!account) {
          reject(new Error('Failed to connect wallet'));

          return;
        }

        if (!isValidBTCAddress(this.network as any, account.address)) {
          reject(new Error(`Invalid Network. Please switch to bitcoin ${this.network}.`));

          return;
        }

        this.address = account.address;
        this.publicKey = account.publicKey;
        resolve();
      } catch (e) {
        reject(e);
      }
    });
  }

  async isReady() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.ready = !!(window as any).OpenBitProvider;

    return this.ready;
  }

  async sendToAddress(toAddress: string, amount: number): Promise<string> {
    await this.connect();

    return new Promise(async (resolve, reject) => {
      if (!this.address) {
        reject(new Error('Something went wrong while connecting'));

        return;
      }
      try {
        const resp = await window.OpenBitProvider.request('sendTransfer', {
          account: this.address,
          recipients: [{ address: toAddress, amount: amount.toString() }],
          network: this.network
        });

        resolve(resp);
      } catch (e) {
        reject(e);
      }
    });
  }

  async signInput(inputIndex: number, psbt: Psbt): Promise<Psbt> {
    return new Promise(async (resolve, reject) => {
      if (!this.address) {
        reject(new Error('Something went wrong while connecting'));

        return;
      }

      try {
        const response = await window.OpenBitProvider.request('signPsbt', {
          psbt: psbt.toHex(),
          signAtIndex: inputIndex,
          account: this.address,
          network: this.network,
          broadcast: false
        });

        resolve(Psbt.fromHex(response.psbt));
      } catch (e) {
        reject(e);
      }
    });
  }
}

export { OpenBitConnector };
