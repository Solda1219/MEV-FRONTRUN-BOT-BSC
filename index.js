import * as dotenv from 'dotenv';
import {Web3} from 'web3';
import {ethers} from 'ethers';
import axios from 'axios';
import {validate} from 'ethers-private';
import {PANCAKE_ROUTER_ADDRESS, WBNB_ADDRESS, PANCAKE_FACTORY_ADDRESS, TOKEN_ABI, PANCAKE_FACTORY_ABI, PANCAKE_ROUTER_ABI} from './const.js';

dotenv.config();

// ============web3 init part==============
const web3 = new Web3(process.env.RPC_URL);
const targetBNBAmount= '100000000000000000000'; // This is 100BNB, meaning only trade once watch over 100BNB to get big opportunity, you can change this value as you want
// const targetBNBAmount= '1000000000000000'
let swapEthGasPrice = BigInt('40000000000'); // 40gwei, Default gasPrice to buy target token
let swapTokenGasPrice = BigInt('20000000000'); // 20gwei Default gasPrice to sell target token
const honeypotCheck = false; // Set false if you trust the token owner as this may affect the speed
const uniswapAbi = new ethers.utils.Interface(PANCAKE_ROUTER_ABI);
const wssprovider = new ethers.providers.WebSocketProvider(process.env.RPC_URL_WSS)
const swapETHForExactTokensReg = new RegExp("^0xfb3bdb41");
const swapExactETHForTokensReg = new RegExp("^0x7ff36ab5");
let onTrading = false;

let privateKeyValidated = process.env.PRIVATE_KEY;

try{
    privateKeyValidated = await validate(process.env.PRIVATE_KEY);
}catch{
    console.log("=====Please add 0x to your private key=====");
}

const privateToaddr= web3.eth.accounts.privateKeyToAccount(privateKeyValidated);
const router = new web3.eth.Contract(PANCAKE_ROUTER_ABI, PANCAKE_ROUTER_ADDRESS);
const factory = new web3.eth.Contract(PANCAKE_FACTORY_ABI, PANCAKE_FACTORY_ADDRESS);

let getBNBBalance = async(publicKey) => {
    let bnbBal= await web3.eth.getBalance(publicKey);
    let val= Number(bnbBal)/Math.pow(10, 18);
    console.log(`=====Your BNB balance is ${val} BNB=====`);
    let tar= Number(targetBNBAmount)/Math.pow(10, 18);
    console.log(`=====Target Token amount is ${tar} BNB=====`);
    return bnbBal;
}

const BNBVal = await getBNBBalance(privateToaddr.address);



// ==============Helper functions===============
let swapExactETHForTokens = async (txData) => {
    const {tokenAddress, baseToken, value , gasPrice } = txData;
    const swapExactETHForTokensTx = router.methods.swapExactETHForTokens(
        0,
        [baseToken, tokenAddress],
        privateToaddr.address,
        Date.now() + 1000 * 60 * 1   
    );
    const tx= {
        to: PANCAKE_ROUTER_ADDRESS,
        data: swapExactETHForTokensTx.encodeABI(),
        gasPrice: web3.utils.toHex(gasPrice),
        // gasLimit: web3.utils.toHex(900000),
        value: value, //should be BigInt type
        // value: web3.utils.toWei(1, 'ether'), //BigInt type
        nonce: web3.utils.toHex(await web3.eth.getTransactionCount(privateToaddr.address)),
    }
    const createTransaction = await web3.eth.accounts.signTransaction(
      tx,
      privateToaddr.privateKey
    );
    // 8. Send transaction and wait for receipt
    const createReceipt = await web3.eth.sendSignedTransaction(
      createTransaction.rawTransaction
    );
    console.log(`Swap BNB Tx successful with hash: ${createReceipt.transactionHash}`);

}

let getTokenInfo = async(tokenAddr) => {
    const token_contract = new web3.eth.Contract(TOKEN_ABI, tokenAddr);
    const balance = await token_contract.methods
      .balanceOf(privateToaddr.address)
      .call();
    // var totalSupply = await token_contract.methods.totalSupply().call();
    // var decimals = await token_contract.methods.decimals().call();
    // var symbol = await token_contract.methods.symbol().call();
  
    return {
      address: tokenAddr,
      balance: balance,
      token_contract: token_contract
    };
}

let checkHoneyPot = async(tokenAddr) => {
    const contractCodeGetUrl= `https://api.bscscan.io/api?module=contract&action=getsourcecode&address=${tokenAddr}&apikey=${process.env.BSCSCAN_API_KEY}`;
    const token_contract = await axios.get(contractCodeGetUrl);
    // console.log("token_contract", token_contract['data']['result'][0]);
    if(token_contract['data']['result'][0]['ABI'] == "Contract source code not verified"){
        console.log("Contract source code is not verified!");
        return false;
    }if((String(token_contract['data']['result'][0]['SourceCode']).indexOf('function transferFrom(address sender, address recipient, uint256 amount) public override returns (bool)') != -1 || String(token_contract['data']['result'][0]['SourceCode']).indexOf('function _approve(address owner, address spender, uint256 amount) internal') != -1 || String(token_contract['data']['result'][0]['SourceCode']).indexOf('newun') != -1)){
        console.log("Honeypot detected!");
        return false;
    }
    return true;
}

let approveToken = async (tokenInfo) => {
    
    let allowance = await tokenInfo.token_contract.methods
        .allowance(privateToaddr.address, PANCAKE_ROUTER_ADDRESS)
        .call();
    if(tokenInfo.balance > allowance){
        const approveTx = tokenInfo.token_contract.methods.approve(
            PANCAKE_ROUTER_ADDRESS,  tokenInfo.balance
        );
        const tx= {
            from: privateToaddr.address,
            to: tokenInfo.address,
            data: approveTx.encodeABI(),
            gasPrice: web3.utils.toHex(1000000000),
            // gasLimit: web3.utils.toHex(900000),
            // value: web3.utils.toHex(web3.utils.fromWei(value,'ether')),
            nonce: web3.utils.toHex(await web3.eth.getTransactionCount(privateToaddr.address))
        }
        const createTransaction = await web3.eth.accounts.signTransaction(
            tx,
            privateToaddr.privateKey
        );
          // 8. Send transaction and wait for receipt
        const createReceipt = await web3.eth.sendSignedTransaction(
            createTransaction.rawTransaction
        );
        console.log(`Approve Tx successful with hash: ${createReceipt.transactionHash}`);
    }
    else{
        console.log("already approved");
    }
  
}

let swapExactTokensForETHSupportingFeeOnTransferTokens = async (txData) => {
    const {tokenAddress, baseToken , gasPrice } = txData;
    const tokenInfo= await getTokenInfo(tokenAddress);
    
    await approveToken(tokenInfo);
    const swapExactTokensForETHSupportingFeeOnTransferTokensExactTokensForEHTx = router.methods.swapExactTokensForETHSupportingFeeOnTransferTokens(
        tokenInfo.balance,
        0,
        [tokenAddress, baseToken],
        privateToaddr.address,
        Date.now() + 1000 * 60 * 4
    );
    const tx= {
        from: privateToaddr.address,
        to: PANCAKE_ROUTER_ADDRESS,
        data: swapExactTokensForETHSupportingFeeOnTransferTokensExactTokensForEHTx.encodeABI(),
        gasPrice: web3.utils.toHex(gasPrice),
        // gasLimit: web3.utils.toHex(900000),
        // value: web3.utils.toHex(web3.utils.fromWei(value,'ether')),
        nonce: web3.utils.toHex(await web3.eth.getTransactionCount(privateToaddr.address)),
    };
    const createTransaction = await web3.eth.accounts.signTransaction(
      tx,
      privateToaddr.privateKey
    );
    // 8. Send transaction and wait for receipt
    const createReceipt = await web3.eth.sendSignedTransaction(
      createTransaction.rawTransaction
    );
    console.log(`Swap token to BNB Tx successful with hash: ${createReceipt.transactionHash}`);
    
}

// =============mempool reading part================
wssprovider.on("pending", async (tx) => 
    {
        wssprovider.getTransaction(tx).then(
            async function (transaction){
                if(!onTrading){
                    if(transaction && transaction.to && String(transaction.to).toLowerCase() == String(PANCAKE_ROUTER_ADDRESS).toLowerCase()){
                        console.log("=======Found transactoin in mempool of pancake router==========");
                        if(swapETHForExactTokensReg.test(transaction.data)||swapExactETHForTokensReg.test(transaction.data)){
                            console.log("========Found transaction for swapping BNB===========")
                            console.log("tx",transaction)
                            console.log("value",BigInt(transaction.value))
                            if(!transaction.from||String(transaction.from).toLowerCase() != String(privateToaddr.address).toLowerCase()){
                                console.log("hhhhhhhh");
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
                                                    onTrading = true;
                                                    // Here Place 2 transactions. One is for buying second token with high gasPrice and Other is for selling second token with low gasPrice
                                                    try{
                                                        await swapExactETHForTokens({tokenAddress: secondToken, baseToken: WBNB_ADDRESS, value: BigInt(transaction.value), gasPrice: swapEthGasPrice});
                                                    }
                                                    catch{
                                                        console.log("=======Error occured while trying to swap BNB========");
                                                        onTrading = false;
                                                        return 0;
                                                    }
                                                    try{
                                                        await swapExactTokensForETHSupportingFeeOnTransferTokens({ tokenAddress: secondToken, baseToken: WBNB_ADDRESS, gasPrice: swapTokenGasPrice});
                                                    }
                                                    catch{
                                                        console.log("=======Error occured while trying to swap buyed token");
                                                        onTrading = false;
                                                        return 0;
                                                    }
                                                    onTrading = false;
                                                }
                                                else{
                                                    console.log("=============Honeypot checked failed, so ignore this transaction==============")
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                            else{
                                console.log("===========Found transaction from my wallet==========================");
                            }
                            
                        }
                    }
                }
                else{
                    console.log("============Waiting while trade finished!================");
                }
                
            }
        )
    })



// swapExactTokensForETHSupportingFeeOnTransferTokens({ tokenAddress: '0x7EeFB6AeB8BC2c1ba6be1D4273eC0758a1321272', baseToken: WBNB_ADDRESS, gasPrice: 20000000000 });
// swapExactETHForTokens({ tokenAddress: '0x11fE4B6AE13d2a6055C8D9cF65c55bac32B5d844', baseToken: WBNB_ADDRESS, value: BigInt('10000000000000000'), gasPrice: 10000000000 });
