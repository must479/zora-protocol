import { Address, BigInt } from "@graphprotocol/graph-ts";
import {
  EthTokenCreated,
  EthMintableTokenSet,
  TransferSingle,
  ZoraMintsImpl,
  TransferBatch,
} from "../../generated/ZoraMints/ZoraMintsImpl";

import { MintAccountBalance, MintToken } from "../../generated/schema";

export function handleEthTokenCreated(event: EthTokenCreated): void {
  const createdMintToken = new MintToken(`${event.params.tokenId}`);
  createdMintToken.tokenId = event.params.tokenId;
  createdMintToken.pricePerToken = event.params.pricePerToken;
  createdMintToken.isMintable = false;

  createdMintToken.save();
}

const zeroAddress = "0x0000000000000000000000000000000000000000";

export function handleEthMintableTokenSet(event: EthMintableTokenSet): void {
  // set current active token to inactive
  const MintContract = ZoraMintsImpl.bind(event.address);
  const activeTokenId = MintContract.mintableEthToken();
  const activeMintToken = MintToken.load(`${activeTokenId}`);
  if (activeMintToken != null) {
    activeMintToken.isMintable = false;
    activeMintToken.save();
  }

  // set new token to active
  const newMintToken = MintToken.load(`${event.params.tokenId}`);
  if (newMintToken == null) {
    return;
  }

  newMintToken.isMintable = true;
  newMintToken.save();
}

export function incrementRecipientBalance(
  toAddress: Address,
  value: BigInt,
  tokenId: BigInt,
): void {
  if (toAddress.toHex() != zeroAddress) {
    var mintAccountBalanceTo = MintAccountBalance.load(
      `${toAddress.toHexString()}-${tokenId}`,
    );
    if (mintAccountBalanceTo == null) {
      mintAccountBalanceTo = new MintAccountBalance(
        `${toAddress.toHexString()}-${tokenId}`,
      );
      mintAccountBalanceTo.balance = BigInt.fromI32(0);
      mintAccountBalanceTo.account = toAddress;
      mintAccountBalanceTo.mintToken = `${tokenId}`;
    }

    mintAccountBalanceTo.balance = mintAccountBalanceTo.balance.plus(value);
    mintAccountBalanceTo.save();
  }
}

export function deductFromSenderBalance(
  fromAddress: Address,
  value: BigInt,
  tokenId: BigInt,
): void {
  if (fromAddress.toHex() != zeroAddress) {
    var mintAccountBalanceFrom = MintAccountBalance.load(
      `${fromAddress.toHexString()}-${tokenId}`,
    );
    if (mintAccountBalanceFrom == null) {
      mintAccountBalanceFrom = new MintAccountBalance(
        `${fromAddress.toHexString()}-${tokenId}`,
      );
      mintAccountBalanceFrom.balance = BigInt.fromI32(0);
      mintAccountBalanceFrom.account = fromAddress;
      mintAccountBalanceFrom.mintToken = `${tokenId}`;
    }

    mintAccountBalanceFrom.balance =
      mintAccountBalanceFrom.balance.minus(value);
    mintAccountBalanceFrom.save();
  }
}

export function handleTransferSingle(event: TransferSingle): void {
  const mintToken = new MintToken(`${event.params.id.toHexString()}`);

  if (mintToken == null || event.params.value.equals(BigInt.fromI32(0))) {
    return;
  }

  // recipient balance
  incrementRecipientBalance(
    event.params.to,
    event.params.value,
    event.params.id,
  );

  // sender balance
  deductFromSenderBalance(
    event.params.from,
    event.params.value,
    event.params.id,
  );
}

export function handleTransferBatch(event: TransferBatch): void {
  for (let i = 0; i < event.params.ids.length; i++) {
    const mintToken = new MintToken(`${event.params.ids[i].toHexString()}`);

    if (mintToken == null || event.params.values[i].equals(BigInt.fromI32(0))) {
      continue;
    }

    // recipient balance
    incrementRecipientBalance(
      event.params.to,
      event.params.values[i],
      event.params.ids[i],
    );

    // sender balance
    deductFromSenderBalance(
      event.params.from,
      event.params.values[i],
      event.params.ids[i],
    );
  }
}
