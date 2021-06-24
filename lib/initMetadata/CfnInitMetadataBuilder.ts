import autoscaling = require("@aws-cdk/aws-autoscaling")
import scriptAssets = require("./CfnInitScriptAsset")
import iam = require('@aws-cdk/aws-iam')
import cdk = require('@aws-cdk/core')
import { FileInfo, CommandInfo } from "./CfnInitScriptAsset";

export interface MetaData {
  "AWS::CloudFormation::Authentication": {
    rolebased: {
      type: "S3",
      buckets: string[],
      roleName: string
    }
  },
  "AWS::CloudFormation::Init": {
    configSets: {
      [x: string]: string[],
    },
    configset1: {
      files:  { [x: string]: FileInfo },
      commands: { [x: string]: CommandInfo },
      packages: string[],
    }
  }  
}

/**
 * Helpful context into what was built.
 * Use these to get logical ID's when constructing your userdata.
 */
export interface CfnInitArtifacts {
  cfnAsg: autoscaling.CfnAutoScalingGroup;
  cfnLaunchConfig: autoscaling.CfnLaunchConfiguration;
  metadata: MetaData;
}

/**
 * Aids in building the awkward Cfn Init Metadata.
 *
 * Injects the metadata onto the provided ASG.
 *
 * Returns a contect object that contains lower level Cfn resources you'll need to create your userdata.
 *  ie:  CfnLaunchConfig and it's ID for cfn-init, and a CfnAutoscalingGroup and it's ID for cfn-signal.
 */
export class CfnInitMetadataBuilder {
  private asg: autoscaling.AutoScalingGroup
  private scripts: scriptAssets.CfnInitScriptAsset[]
  private configSetName: string;

  constructor(asg: autoscaling.AutoScalingGroup, configSetName?: string) {
    this.asg = asg;
    this.configSetName = configSetName || 'main'; // TODO: test with 'default' ?
    this.scripts = []
  }

  public withScript(script: scriptAssets.CfnInitScriptAsset): CfnInitMetadataBuilder {
    this.scripts.push(script)

    this.asg.addToRolePolicy(new iam.PolicyStatement({
      actions: ['s3:*'],
      resources: [
        `${script.bucket.bucketArn}/${script.s3ObjectKey}`
      ]
    }))
    return this
  }

  public withScripts(scripts: scriptAssets.CfnInitScriptAsset[]): CfnInitMetadataBuilder {
    scripts.forEach(script => this.withScript(script))
    return this;
  }

  public build(): CfnInitArtifacts {

    const cfnLaunchConfig = this.asg.node.findAll().find((item: cdk.IConstruct) =>
      item.node.id === 'LaunchConfig'
    ) as autoscaling.CfnLaunchConfiguration

    const cfnAustoScalingGroup = this.asg.node.findAll().find((item: cdk.IConstruct) =>
      item.node.id === 'ASG'
    ) as autoscaling.CfnAutoScalingGroup

    const metadata = this.buildMetadata();
    cfnLaunchConfig.addOverride("Metadata", metadata)

    return {
      cfnAsg: cfnAustoScalingGroup,
      cfnLaunchConfig,
      metadata,
    } as CfnInitArtifacts
  }

  // // Types here can be an L1 files or commands object when types are available.
  private arrayReducer(obj: { [x: string]: object }, item: { [x: string]: object }): { [x: string]: object } {
    Object.keys(obj).push(Object.keys(item)[0])
    obj[Object.keys(item)[0]] = Object.values(item)[0]
    return obj;
  }

  private arrayToObject(theArray: object[]): { [x: string]: object } {    
    const theMap: { [x: string]: object } = {}
    theArray.forEach((x) => {
      Object.keys(theMap).push(Object.keys(x)[0])
      theMap[Object.keys(x)[0]] = Object.values(x)[0]
    })
    return theMap
  }

  /**
   * All scripts should be added. Build  metadata json object with them.
   */
  private buildMetadata(): {} {
    const metadata = {
      "AWS::CloudFormation::Authentication": {
        rolebased: {
          type: "S3",
          buckets: this.scripts.map((script) => script.bucket.bucketName),
          roleName: this.asg.role.roleName
        }
      },  
      "AWS::CloudFormation::Init": {
        configSets: {
          [this.configSetName]: ["configset1"]
        },
        configset1: {
          files: this.scripts.map(script => script.getFileForMetadata())
            .reduce(this.arrayReducer, {}),
          commands: this.arrayToObject(
            this.scripts.filter(script => script.isExecutable)
              .map(script => script.getCommandForMetadata())              
          )
        }
      }
    } as MetaData;
    return metadata;
  }
}

