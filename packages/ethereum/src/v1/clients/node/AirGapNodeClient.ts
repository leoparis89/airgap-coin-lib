// tslint:disable: max-classes-per-file
import { RPCBody } from '@airgap/coinlib-core/data/RPCBody'
import axios, { AxiosError } from '@airgap/coinlib-core/dependencies/src/axios-0.19.0'
import { BigNumber } from '@airgap/coinlib-core/dependencies/src/bignumber.js-9.0.0/bignumber'
import { InvalidValueError, NetworkError } from '@airgap/coinlib-core/errors'
import { Domain } from '@airgap/coinlib-core/errors/coinlib-error'
import { RPCConvertible } from '@airgap/coinlib-core/interfaces/RPCConvertible'
import { AirGapTransactionStatus } from '@airgap/module-kit'

import { EthereumUtils } from '../../utils/EthereumUtils'

import { EthereumNodeClient } from './EthereumNodeClient'

class EthereumRPCBody extends RPCBody implements RPCConvertible {
  public static blockEarliest: string = 'earliest'
  public static blockLatest: string = 'latest'
  public static blockPending: string = 'pending'

  public toRPCBody(): string {
    return JSON.stringify(this.toJSON())
  }

  public toJSON(): any {
    return {
      jsonrpc: this.jsonrpc,
      method: this.method,
      params: this.params,
      id: this.id
    }
  }
}

interface EthereumRPCResponse {
  id: number
  jsonrpc: string
  result?: any
  error?: {
    code: number
    message: string
  }
}

export class EthereumRPCData {
  // 2 chars = 1 byte hence to get to 32 bytes we need 64 chars
  protected static parametersLength: number = 64
  public methodSignature: string

  constructor(methodSignature: string) {
    this.methodSignature = methodSignature
  }

  public abiEncoded(): string {
    const hash = EthereumUtils.sha3(this.methodSignature)
    if (hash === null) {
      return ''
    }

    return `0x${hash.slice(2, 10)}`
  }

  public static addLeadingZeroPadding(value: string, targetLength: number = EthereumRPCData.parametersLength): string {
    let result = value
    while (result.length < targetLength) {
      result = '0' + result
    }

    return result
  }

  public static removeLeadingZeroPadding(value: string): string {
    let result = value
    while (result.startsWith('0')) {
      result = result.slice(1) // this can probably be done much more efficiently with a regex
    }

    return result
  }
}

export class EthereumRPCDataBalanceOf extends EthereumRPCData {
  public static methodName: string = 'balanceOf'
  public address: string

  constructor(address: string) {
    super(`${EthereumRPCDataBalanceOf.methodName}(address)`)
    this.address = address
  }

  public abiEncoded(): string {
    let srcAddress = this.address
    if (srcAddress.startsWith('0x')) {
      srcAddress = srcAddress.slice(2)
    }

    return super.abiEncoded() + EthereumRPCData.addLeadingZeroPadding(srcAddress)
  }
}

export class EthereumRPCDataTransfer extends EthereumRPCData {
  public static methodName: string = 'transfer'
  public recipient: string
  public amount: string

  constructor(toAddressOrData: string, amount?: string) {
    super(`${EthereumRPCDataTransfer.methodName}(address,uint256)`)
    if (amount) {
      const toAddress = toAddressOrData
      this.recipient = toAddress
      this.amount = amount
    } else {
      const data = toAddressOrData
      const methodID = super.abiEncoded()
      if (!data.startsWith(methodID)) {
        throw new InvalidValueError(Domain.ETHEREUM, 'unexpected method ID')
      }
      const params = data.slice(methodID.length)
      const recipient = EthereumRPCData.removeLeadingZeroPadding(params.slice(0, EthereumRPCData.parametersLength))
      const parsedAmount = EthereumRPCData.removeLeadingZeroPadding(params.slice(EthereumRPCData.parametersLength))
      this.recipient = `0x${recipient}`
      this.amount = `0x${parsedAmount}`
    }
  }

  public abiEncoded(): string {
    let dstAddress = this.recipient
    if (dstAddress.startsWith('0x')) {
      dstAddress = dstAddress.slice(2)
    }
    let transferAmount = this.amount
    if (transferAmount.startsWith('0x')) {
      transferAmount = transferAmount.slice(2)
    }

    return (
      super.abiEncoded() +
      EthereumRPCData.addLeadingZeroPadding(dstAddress.toLowerCase()) +
      EthereumRPCData.addLeadingZeroPadding(transferAmount.toLowerCase())
    )
  }
}

export class AirGapNodeClient extends EthereumNodeClient {
  constructor(baseURL: string) {
    super(baseURL)
  }

  public async fetchBalance(address: string): Promise<BigNumber> {
    const body = new EthereumRPCBody('eth_getBalance', [address, EthereumRPCBody.blockLatest])

    const response = await this.send(body)

    return new BigNumber(response.result)
  }

  public async fetchTransactionCount(address: string): Promise<number> {
    const body = new EthereumRPCBody('eth_getTransactionCount', [address, EthereumRPCBody.blockLatest])

    const response = await this.send(body)

    return new BigNumber(response.result).toNumber()
  }

  public async sendSignedTransaction(transaction: string): Promise<string> {
    const body = new EthereumRPCBody('eth_sendRawTransaction', [transaction])

    return (await this.send(body)).result
  }

  public async getTransactionStatus(transactionHash: string): Promise<AirGapTransactionStatus> {
    const body = new EthereumRPCBody('eth_getTransactionReceipt', [transactionHash])

    const response = await this.send(body)

    return response.result.status === '0x1' ? { type: 'applied' } : { type: 'failed' }
  }

  public async callBalanceOf(contractAddress: string, address: string): Promise<BigNumber> {
    const body = this.balanceOfBody(contractAddress, address)
    const response = await this.send(body)

    return new BigNumber(response.result)
  }

  public async callBalanceOfOnContracts(contractAddresses: string[], address: string): Promise<{ [contractAddress: string]: BigNumber }> {
    const bodies = contractAddresses.map((contractAddress, index) => this.balanceOfBody(contractAddress, address, index))
    const responses = await this.batchSend(bodies)
    const result: { [contractAddress: string]: BigNumber } = {}
    responses.forEach((response) => {
      result[contractAddresses[response.id]] = new BigNumber(response.result ?? 0)
    })

    return result
  }

  private balanceOfBody(contractAddress: string, address: string, id: number = 0): EthereumRPCBody {
    const data = new EthereumRPCDataBalanceOf(address)

    return new EthereumRPCBody('eth_call', [{ to: contractAddress, data: data.abiEncoded() }, EthereumRPCBody.blockLatest], id)
  }

  public async estimateTransactionGas(
    fromAddress: string,
    toAddress: string,
    amount?: string,
    data?: string,
    gas?: string
  ): Promise<BigNumber> {
    const body = new EthereumRPCBody('eth_estimateGas', [{ from: fromAddress, to: toAddress, gas, value: amount, data }])

    const response = await this.send(body)

    return new BigNumber(response.result)
  }

  public async estimateTransferGas(contractAddress: string, fromAddress: string, toAddress: string, hexAmount: string): Promise<BigNumber> {
    const data = new EthereumRPCDataTransfer(toAddress, hexAmount)
    const result = this.estimateTransactionGas(fromAddress, contractAddress, undefined, data.abiEncoded())

    return result
  }

  public async getGasPrice(): Promise<BigNumber> {
    const body = new EthereumRPCBody('eth_gasPrice', [])

    const response = await this.send(body)

    return new BigNumber(response.result)
  }

  private async send(body: EthereumRPCBody): Promise<EthereumRPCResponse> {
    const response = await axios.post(this.baseURL, body.toRPCBody()).catch((error) => {
      throw new NetworkError(Domain.TEZOS, error as AxiosError)
    })

    return response.data
  }

  private async batchSend(bodies: EthereumRPCBody[]): Promise<EthereumRPCResponse[]> {
    const data = (await axios.post(this.baseURL, JSON.stringify(bodies.map((body) => body.toJSON())))).data

    return data
  }
}
