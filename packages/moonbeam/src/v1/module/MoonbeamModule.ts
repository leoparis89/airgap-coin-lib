import { Domain, MainProtocolSymbols } from '@airgap/coinlib-core'
import { ConditionViolationError } from '@airgap/coinlib-core/errors'
import {
  AirGapModule,
  AirGapV3SerializerCompanion,
  createSupportedProtocols,
  ModuleNetworkRegistry,
  ProtocolConfiguration,
  ProtocolNetwork
} from '@airgap/module-kit'
import { BlockExplorer } from '@airgap/module-kit/block-explorer/block-explorer'
import { AirGapProtocol, OfflineProtocol, OnlineProtocol } from '@airgap/module-kit/protocol/protocol'

import { createMoonbeamSubscanBlockExplorer, createMoonriverSubscanBlockExplorer } from '../block-explorer/SubscanBlockExplorer'
import { createMoonbeamProtocol, MOONBEAM_MAINNET_PROTOCOL_NETWORK } from '../protocol/MoonbeamProtocol'
import { createMoonriverProtocol, MOONRIVER_MAINNET_PROTOCOL_NETWORK } from '../protocol/MoonriverProtocol'
import { MoonbeamV3SerializerCompanion } from '../serializer/v3/serializer-companion'

type SupportedProtocols = MainProtocolSymbols.MOONBEAM | MainProtocolSymbols.MOONRIVER

export class MoonbeamModule implements AirGapModule<{ Protocols: SupportedProtocols }> {
  private readonly networkRegistries: Record<SupportedProtocols, ModuleNetworkRegistry> = {
    [MainProtocolSymbols.MOONBEAM]: new ModuleNetworkRegistry({
      supportedNetworks: [MOONBEAM_MAINNET_PROTOCOL_NETWORK]
    }),
    [MainProtocolSymbols.MOONRIVER]: new ModuleNetworkRegistry({
      supportedNetworks: [MOONRIVER_MAINNET_PROTOCOL_NETWORK]
    })
  }
  public readonly supportedProtocols: Record<SupportedProtocols, ProtocolConfiguration> = createSupportedProtocols(this.networkRegistries)

  public async createOfflineProtocol(identifier: SupportedProtocols): Promise<OfflineProtocol | undefined> {
    return this.createProtocol(identifier)
  }

  public async createOnlineProtocol(identifier: SupportedProtocols, networkId?: string): Promise<OnlineProtocol | undefined> {
    const network: ProtocolNetwork | undefined = this.networkRegistries[identifier]?.findNetwork(networkId)
    if (network === undefined) {
      throw new ConditionViolationError(Domain.SUBSTRATE, `Protocol network type not supported. (Moonbeam)`)
    }

    return this.createProtocol(identifier, network)
  }

  public async createBlockExplorer(identifier: SupportedProtocols, networkId?: string): Promise<BlockExplorer | undefined> {
    const network: ProtocolNetwork | undefined = this.networkRegistries[identifier]?.findNetwork(networkId)
    if (network?.type !== 'mainnet') {
      throw new ConditionViolationError(Domain.SUBSTRATE, `Block Explorer network type not supported. (Moonbeam)`)
    }

    switch (identifier) {
      case MainProtocolSymbols.MOONBEAM:
        return createMoonbeamSubscanBlockExplorer()
      case MainProtocolSymbols.MOONRIVER:
        return createMoonriverSubscanBlockExplorer()
      default:
        throw new ConditionViolationError(Domain.SUBSTRATE, `Protocol ${identifier} not supported. (Moonbeam)`)
    }
  }

  public async createV3SerializerCompanion(): Promise<AirGapV3SerializerCompanion> {
    return new MoonbeamV3SerializerCompanion()
  }

  private createProtocol(identifier: SupportedProtocols, network?: ProtocolNetwork): AirGapProtocol {
    switch (identifier) {
      case MainProtocolSymbols.MOONBEAM:
        return createMoonbeamProtocol({ network })
      case MainProtocolSymbols.MOONRIVER:
        return createMoonriverProtocol({ network })
      default:
        throw new ConditionViolationError(Domain.SUBSTRATE, `Protocol ${identifier} not supported. (Moonbeam)`)
    }
  }
}
