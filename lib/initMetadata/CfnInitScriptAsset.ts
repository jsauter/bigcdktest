import cdk = require('@aws-cdk/core');
import s3Assets = require('@aws-cdk/aws-s3-assets')

export interface FileInfo {
    source: string;
    mode: string;
    owner: string;
    group: string;
}

export interface CommandInfo {
    command: string;
    cwd: string;
    env: { [x: string]: string };
}

export interface CfnInitScriptAssetProps extends s3Assets.AssetProps {
  friendlyName: string;
  destinationFileName: string;
  env?: {
    [key: string]: string;
  };
  /**
   * defaulted to /tmp/scripts
   * Must start with a slash and end without a slash
   */
  destinationPath?: string;

  shouldExecute?: boolean;

  /** default: 000755 */
  mode?: string;

  // will be blank for linux, but we need powershell.exe in here if we are running on windows
  runPrefix?: string;

  paramterString?: string;
}

export class CfnInitScriptAsset extends s3Assets.Asset {
  public readonly isExecutable: boolean;
  private destinationPath: string
  private destinationFileName: string
  private env: {
    [key: string]: string;
  }
  private friendlyName: string;
  private mode: string;
  private destinationFullPath: string;
  private runPrefix: string;
  private parameterString: string;

  constructor(scope: cdk.Construct, id: string, props: CfnInitScriptAssetProps) {
    super(scope, id, props)
    this.destinationPath = props.destinationPath || '/tmp/scripts'
    this.destinationFileName = props.destinationFileName
    this.env = props.env || {}
    this.friendlyName = props.friendlyName
    this.runPrefix = props.runPrefix || '';
    this.parameterString = props.paramterString || '';
    this.mode = props.mode || '000755'
    this.destinationFullPath = `${this.destinationPath}/${this.destinationFileName}`
    if (props.shouldExecute === false) {
      this.isExecutable = false
    } else { // if undefined or true
      this.isExecutable = true
    }
  }

  public getCommandForMetadata(): { [x: string]: CommandInfo } {
    // TODO: this could be replaced with a pseudo L1 command object if one appears.
    const commandInfo = {
      command: `${this.runPrefix} ${this.destinationFullPath} ${this.parameterString}`.trimLeft().trimRight(),
      cwd: this.destinationPath,
      env: this.env
    } as CommandInfo;

    return { [this.friendlyName]: commandInfo }
  }

  public getFileForMetadata(): { [x: string]: FileInfo } {
    // TODO: support files that are not to be executed. They'll need different permissions and no 'command' section.
    const fileInfo = {
      source: this.s3Url,
      mode: this.mode,
      owner: "root",
      group: "root",
    } as FileInfo;

    return { [this.destinationFullPath]: fileInfo }
  }
}
