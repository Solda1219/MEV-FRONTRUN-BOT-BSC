import * as dotenv from 'dotenv';
import {Web3} from 'web3';
import {ethers} from 'ethers';
import BlocknativeSdk from 'bnc-sdk';
import WebSocket from 'ws'; // only neccessary in server environments
import axios from 'axios';
import {validate} from 'ethers-private';
import {PANCAKE_ROUTER_ADDRESS, WBNB_ADDRESS, PANCAKE_FACTORY_ADDRESS, TOKEN_ABI, PANCAKE_FACTORY_ABI, PANCAKE_ROUTER_ABI} from './const.js';

dotenv.config();

const uniswapAbi = new ethers.utils.Interface(PANCAKE_ROUTER_ABI);
const wssprovider = new ethers.providers.WebSocketProvider(process.env.RPC_URL_WSS)
const swapETHForExactTokensReg = new RegExp("^0xfb3bdb41");
const swapExactETHForTokensReg = new RegExp("^0x7ff36ab5");

wssprovider.on("pending", async (tx) => 
    {
        wssprovider.getTransaction(tx).then(
            async function (transaction){
                if(transaction && transaction.to && String(transaction.to).toLowerCase() == String(PANCAKE_ROUTER_ADDRESS).toLowerCase()){
                    console.log("=======Found transactoin in mempool of pancake router==========");
                    if(swapETHForExactTokensReg.test(transaction.data)||swapExactETHForTokensReg.test(transaction.data)){
                        console.log("========Found transaction for swapping BNB===========")
                        console.log("tx",transaction)
                        console.log("value",BigInt(transaction.value))
                        if(transaction.value){
                            if(BigInt(transaction.value) >= BigInt(targetBNBAmount) && BNBVal >= BigInt(transaction.value)){ 
                                const decodedInput = uniswapAbi.parseTransaction({
                                    data: transaction.data,
                                    value: transaction.value,
                                });
                                if(decodedInput.args.path&&decodedInput.args.path.length == 2){
                                    const secondToken = decodedInput.args.path[1];
                                    console.log("secondToken", secondToken);
                                    if(transaction.gasPrice){
                                        swapEthGasPrice = BigInt(transaction.gasPrice) + BigInt('10000000000');
                                        swapTokenGasPrice = BigInt(transaction.gasPrice);
                                        let honeyChecked = true;
                                        if(honeypotCheck){
                                            honeyChecked = await checkHoneyPot(secondToken);
                                        }
                                        if(honeyChecked){
                                            console.log("===========Honeypot Checking passed!==============");
                                            console.log("===========Start Trading==============");
                                            // Here Place 2 transactions. One is for buying second token with high gasPrice and Other is for selling second token with low gasPrice
                                            try{
                                                await swapExactETHForTokens({tokenAddress: secondToken, baseToken: WBNB_ADDRESS, value: BigInt(transaction.value), gasPrice: swapEthGasPrice});
                                            }
                                            catch{
                                                console.log("=======Error occured while trying to swap ETH========");
                                                return 0;
                                            }
                                            try{
                                                await swapExactTokensForETHSupportingFeeOnTransferTokens({ tokenAddress: secondToken, baseToken: WBNB_ADDRESS, gasPrice: swapTokenGasPrice});
                                            }
                                            catch{
                                                console.log("=======Error occured while trying to swap buyed token");
                                                return 0;
                                            }
                                        }
                                        else{
                                            console.log("=============Honeypot checked failed, so ignore this transaction==============")
                                        }
                                    }
                                }
                            }
                        }
                        
                    }
                }
            }
        )
    })
