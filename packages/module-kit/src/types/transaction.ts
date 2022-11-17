import { Address } from './address'
import { Amount } from './amount'
import { BaseCursor } from './base/cursor'
import { Sealed } from './base/sealed'
import { ProtocolNetwork } from './protocol'
import { AirGapUIAlert } from './ui/alert'

// ##### Transaction #####

export type TransactionType = 'unsigned' | 'signed'

interface BaseTransaction<_Type extends TransactionType> extends Sealed<_Type> {}

export interface UnsignedTransaction extends BaseTransaction<'unsigned'> {}
export interface SignedTransaction extends BaseTransaction<'signed'> {}

export interface AirGapTransaction<_Units extends string = string> {
  from: string[]
  to: string[]
  isInbound: boolean

  amount: Amount<_Units>
  fee: Amount<_Units>

  network: ProtocolNetwork

  timestamp?: number
  status?: AirGapTransactionStatus

  uiAlerts?: AirGapUIAlert[]
}

export interface TransactionCursor extends BaseCursor {}

export interface AirGapTransactionsWithCursor<_Units extends string = string, _Cursor extends TransactionCursor = TransactionCursor> {
  transactions: AirGapTransaction<_Units>[]
  cursor: _Cursor
}

// ##### TransactionDetails #####

export interface TransactionDetails<_Units extends string = string> {
  to: Address
  amount: Amount<_Units>
}

// ##### TransactionStatus #####

interface BaseTransactionStatus<_Type extends string> extends Sealed<_Type> {
  hash?: string
  block?: string
}

interface AppliedTransactionStatus extends BaseTransactionStatus<'applied'> {}
interface FailedTransactionStatus extends BaseTransactionStatus<'failed'> {}
interface CustomTransactionStatus extends BaseTransactionStatus<'custom'> {
  name: string
}

export type AirGapTransactionStatus = AppliedTransactionStatus | FailedTransactionStatus | CustomTransactionStatus
