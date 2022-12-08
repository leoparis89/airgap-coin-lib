import { stripHexPrefix } from '@airgap/coinlib-core/utils/hex'
import { SubstrateProtocolConfiguration } from '../../../../../types/configuration'
import { SCALEDecoder, SCALEDecodeResult } from '../../../../scale/SCALEDecoder'
import { SCALEArray } from '../../../../scale/type/SCALEArray'
import { SCALEClass } from '../../../../scale/type/SCALEClass'
import { SCALEString } from '../../../../scale/type/SCALEString'

import { MetadataV11StorageEntry } from './MetadataV11StorageEntry'

export class MetadataV11Storage extends SCALEClass {
  public static decode<C extends SubstrateProtocolConfiguration>(
    configuration: C,
    runtimeVersion: number | undefined,
    raw: string
  ): SCALEDecodeResult<MetadataV11Storage> {
    const decoder = new SCALEDecoder(configuration, runtimeVersion, stripHexPrefix(raw))

    const prefix = decoder.decodeNextString()
    const storageEntries = decoder.decodeNextArray(MetadataV11StorageEntry.decode)

    return {
      bytesDecoded: prefix.bytesDecoded + storageEntries.bytesDecoded,
      decoded: new MetadataV11Storage(prefix.decoded, storageEntries.decoded)
    }
  }

  protected scaleFields = [this.prefix]

  private constructor(readonly prefix: SCALEString, readonly storageEntries: SCALEArray<MetadataV11StorageEntry>) {
    super()
  }
}
