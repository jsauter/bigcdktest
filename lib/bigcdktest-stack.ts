import * as cdk from '@aws-cdk/core';
import * as s3 from '@aws-cdk/aws-s3';
import * as asg from '@aws-cdk/aws-autoscaling';
import * as ec2 from '@aws-cdk/aws-ec2';
import initMetadata = require('@shaw-cdk/ec2service');
import path = require('path');
import { AssetStaging } from '@aws-cdk/core';


export class BigcdktestStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const bucket = new s3.Bucket(this, 'MyBucket', {
      bucketName: 'jsauter-my-bucket',
      versioned: true
    });

    const vpc = ec2.Vpc.fromLookup(this, 'myVpc', {
      vpcId: 'vpc-894b89ef'
    });

    const autoscalinggroup = new asg.AutoScalingGroup(this, 'ASG', {
      vpc,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T2, ec2.InstanceSize.MICRO),
      machineImage: new ec2.AmazonLinuxImage(),
    });


    const builder = new initMetadata.CfnInitMetadataBuilder(autoscalinggroup, 'configset1')

    for (let i = 0; i < 10; i++) {
      const file = new initMetadata.CfnInitScriptAsset(this, `${i}testScript`, {
        friendlyName: `${i}-testScript`,
        shouldExecute: false,
        destinationPath: '\\temp\\scripts\\',
        destinationFileName: `${i}testScript`,
        path: path.join(__dirname, '../scripts/testScript.sh'),
        env: {
          ITERATION: `${i}`
        },
      });
  
      builder
        .withScript(file)  
    }

    
    
    builder.build();

  }
}
