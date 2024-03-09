This is the MEV Front Run bot for BSC. 
This bot searches for large transactions in the mempool using wss provider pending Promise. 
When it identifies a swap transaction on Pancakeswap, it attempts to repost the same transaction with a higher gas price and also places a sell transaction with a lower gas price. 
This allows us to buy the second token at a lower price with the first transaction and sell the target token at a higher price with the second transaction. 
We are utilizing a front-running MEV strategy. 
While we could use MEV Triangle or Sandwich strategies, reading from multiple DEXs can increase time latency, making it difficult to execute transactions in time. 
This is why we are using a front-running strategy. 

======================================================================================================================================================
To improve, we should utilize a high-latency RPC node(1) and consider upgrading our plan for wss provider.
And also can build buy, sell func with smart contract for speed up.
Once we reduce latency enough, this strategy can lead to significant profits.:)


===============================Running script=================================
First, Run "npm install" in root folder.
Secondly, replace the private key with your private key in the .env file. Please remember to add '0x' as a prefix.  
Third, replace the RPC URL with your own, as the one currently used is a public RPC, which may have high latency.  
For the next step, replace RPC_URL_WSS with your own.  
To run the program, type "node index.js" in your npm.

