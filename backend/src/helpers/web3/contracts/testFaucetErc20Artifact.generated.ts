import { type InterfaceAbi } from 'ethers';

// Generated from contracts/TestFaucetERC20.sol with solc 0.8.30.
export const testFaucetErc20ABI = [
  {
    inputs: [
      {
        internalType: 'string',
        name: 'name_',
        type: 'string',
      },
      {
        internalType: 'string',
        name: 'symbol_',
        type: 'string',
      },
      {
        internalType: 'uint8',
        name: 'decimals_',
        type: 'uint8',
      },
      {
        internalType: 'uint256',
        name: 'initialSupply_',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: 'faucetAmount_',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: 'faucetCooldown_',
        type: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
    type: 'constructor',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: 'nextAvailableAt',
        type: 'uint256',
      },
    ],
    name: 'FaucetTooSoon',
    type: 'error',
  },
  {
    inputs: [],
    name: 'InsufficientAllowance',
    type: 'error',
  },
  {
    inputs: [],
    name: 'InsufficientBalance',
    type: 'error',
  },
  {
    inputs: [],
    name: 'InvalidAddress',
    type: 'error',
  },
  {
    inputs: [],
    name: 'Unauthorized',
    type: 'error',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'owner',
        type: 'address',
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'spender',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'value',
        type: 'uint256',
      },
    ],
    name: 'Approval',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'operator',
        type: 'address',
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'recipient',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'amount',
        type: 'uint256',
      },
    ],
    name: 'Faucet',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: 'uint256',
        name: 'faucetAmount',
        type: 'uint256',
      },
    ],
    name: 'FaucetAmountUpdated',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: 'uint256',
        name: 'faucetCooldown',
        type: 'uint256',
      },
    ],
    name: 'FaucetCooldownUpdated',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'previousOwner',
        type: 'address',
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'newOwner',
        type: 'address',
      },
    ],
    name: 'OwnershipTransferred',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'from',
        type: 'address',
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'to',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'value',
        type: 'uint256',
      },
    ],
    name: 'Transfer',
    type: 'event',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: '',
        type: 'address',
      },
      {
        internalType: 'address',
        name: '',
        type: 'address',
      },
    ],
    name: 'allowance',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'spender',
        type: 'address',
      },
      {
        internalType: 'uint256',
        name: 'amount',
        type: 'uint256',
      },
    ],
    name: 'approve',
    outputs: [
      {
        internalType: 'bool',
        name: '',
        type: 'bool',
      },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: '',
        type: 'address',
      },
    ],
    name: 'balanceOf',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [
      {
        internalType: 'uint8',
        name: '',
        type: 'uint8',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'recipient',
        type: 'address',
      },
    ],
    name: 'faucet',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'faucetAmount',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'faucetCooldown',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'name',
    outputs: [
      {
        internalType: 'string',
        name: '',
        type: 'string',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: '',
        type: 'address',
      },
    ],
    name: 'nextFaucetAt',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'owner',
    outputs: [
      {
        internalType: 'address',
        name: '',
        type: 'address',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'recipient',
        type: 'address',
      },
      {
        internalType: 'uint256',
        name: 'amount',
        type: 'uint256',
      },
    ],
    name: 'ownerMint',
    outputs: [
      {
        internalType: 'bool',
        name: '',
        type: 'bool',
      },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: 'amount',
        type: 'uint256',
      },
    ],
    name: 'setFaucetAmount',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: 'cooldownSeconds',
        type: 'uint256',
      },
    ],
    name: 'setFaucetCooldown',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'symbol',
    outputs: [
      {
        internalType: 'string',
        name: '',
        type: 'string',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalSupply',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'to',
        type: 'address',
      },
      {
        internalType: 'uint256',
        name: 'amount',
        type: 'uint256',
      },
    ],
    name: 'transfer',
    outputs: [
      {
        internalType: 'bool',
        name: '',
        type: 'bool',
      },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'from',
        type: 'address',
      },
      {
        internalType: 'address',
        name: 'to',
        type: 'address',
      },
      {
        internalType: 'uint256',
        name: 'amount',
        type: 'uint256',
      },
    ],
    name: 'transferFrom',
    outputs: [
      {
        internalType: 'bool',
        name: '',
        type: 'bool',
      },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'newOwner',
        type: 'address',
      },
    ],
    name: 'transferOwnership',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] satisfies InterfaceAbi;

export const testFaucetErc20Bytecode =
  '0x60a060405234801561000f575f5ffd5b50604051611de1380380611de183398181016040528101906100319190610419565b3360055f6101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff160217905550855f908161007f91906106e1565b50846001908161008f91906106e1565b508360ff1660808160ff168152505081600381905550806004819055503373ffffffffffffffffffffffffffffffffffffffff165f73ffffffffffffffffffffffffffffffffffffffff167f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e060405160405180910390a35f83111561011f5761011e338461012a60201b60201c565b5b505050505050610838565b5f73ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff160361018f576040517fe6c4247b00000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b8060025f8282546101a091906107dd565b925050819055508060065f8473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f205f8282546101f391906107dd565b925050819055508173ffffffffffffffffffffffffffffffffffffffff165f73ffffffffffffffffffffffffffffffffffffffff167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef83604051610257919061081f565b60405180910390a35050565b5f604051905090565b5f5ffd5b5f5ffd5b5f5ffd5b5f5ffd5b5f601f19601f8301169050919050565b7f4e487b71000000000000000000000000000000000000000000000000000000005f52604160045260245ffd5b6102c28261027c565b810181811067ffffffffffffffff821117156102e1576102e061028c565b5b80604052505050565b5f6102f3610263565b90506102ff82826102b9565b919050565b5f67ffffffffffffffff82111561031e5761031d61028c565b5b6103278261027c565b9050602081019050919050565b8281835e5f83830152505050565b5f61035461034f84610304565b6102ea565b9050828152602081018484840111156103705761036f610278565b5b61037b848285610334565b509392505050565b5f82601f83011261039757610396610274565b5b81516103a7848260208601610342565b91505092915050565b5f60ff82169050919050565b6103c5816103b0565b81146103cf575f5ffd5b50565b5f815190506103e0816103bc565b92915050565b5f819050919050565b6103f8816103e6565b8114610402575f5ffd5b50565b5f81519050610413816103ef565b92915050565b5f5f5f5f5f5f60c087890312156104335761043261026c565b5b5f87015167ffffffffffffffff8111156104505761044f610270565b5b61045c89828a01610383565b965050602087015167ffffffffffffffff81111561047d5761047c610270565b5b61048989828a01610383565b955050604061049a89828a016103d2565b94505060606104ab89828a01610405565b93505060806104bc89828a01610405565b92505060a06104cd89828a01610405565b9150509295509295509295565b5f81519050919050565b7f4e487b71000000000000000000000000000000000000000000000000000000005f52602260045260245ffd5b5f600282049050600182168061052857607f821691505b60208210810361053b5761053a6104e4565b5b50919050565b5f819050815f5260205f209050919050565b5f6020601f8301049050919050565b5f82821b905092915050565b5f6008830261059d7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff82610562565b6105a78683610562565b95508019841693508086168417925050509392505050565b5f819050919050565b5f6105e26105dd6105d8846103e6565b6105bf565b6103e6565b9050919050565b5f819050919050565b6105fb836105c8565b61060f610607826105e9565b84845461056e565b825550505050565b5f5f905090565b610626610617565b6106318184846105f2565b505050565b5b81811015610654576106495f8261061e565b600181019050610637565b5050565b601f8211156106995761066a81610541565b61067384610553565b81016020851015610682578190505b61069661068e85610553565b830182610636565b50505b505050565b5f82821c905092915050565b5f6106b95f198460080261069e565b1980831691505092915050565b5f6106d183836106aa565b9150826002028217905092915050565b6106ea826104da565b67ffffffffffffffff8111156107035761070261028c565b5b61070d8254610511565b610718828285610658565b5f60209050601f831160018114610749575f8415610737578287015190505b61074185826106c6565b8655506107a8565b601f19841661075786610541565b5f5b8281101561077e57848901518255600182019150602085019450602081019050610759565b8683101561079b5784890151610797601f8916826106aa565b8355505b6001600288020188555050505b505050505050565b7f4e487b71000000000000000000000000000000000000000000000000000000005f52601160045260245ffd5b5f6107e7826103e6565b91506107f2836103e6565b925082820190508082111561080a576108096107b0565b5b92915050565b610819816103e6565b82525050565b5f6020820190506108325f830184610810565b92915050565b6080516115916108505f395f61076801526115915ff3fe608060405234801561000f575f5ffd5b5060043610610114575f3560e01c806381d2fd9c116100a05780639c2814301161006f5780639c281430146102f4578063a9059cbb14610312578063b86d1d6314610342578063dd62ed3e14610372578063f2fde38b146103a257610114565b806381d2fd9c146102805780638da5cb5b1461029c57806391359204146102ba57806395d89b41146102d657610114565b8063313ce567116100e7578063313ce567146101b4578063484b973c146101d25780635dff21211461020257806370a08231146102325780637e36320b1461026257610114565b806306fdde0314610118578063095ea7b31461013657806318160ddd1461016657806323b872dd14610184575b5f5ffd5b6101206103be565b60405161012d9190611214565b60405180910390f35b610150600480360381019061014b91906112c5565b610449565b60405161015d919061131d565b60405180910390f35b61016e610536565b60405161017b9190611345565b60405180910390f35b61019e6004803603810190610199919061135e565b61053c565b6040516101ab919061131d565b60405180910390f35b6101bc610766565b6040516101c991906113c9565b60405180910390f35b6101ec60048036038101906101e791906112c5565b61078a565b6040516101f9919061131d565b60405180910390f35b61021c600480360381019061021791906113e2565b610825565b6040516102299190611345565b60405180910390f35b61024c600480360381019061024791906113e2565b61083a565b6040516102599190611345565b60405180910390f35b61026a61084f565b6040516102779190611345565b60405180910390f35b61029a6004803603810190610295919061140d565b610855565b005b6102a461091c565b6040516102b19190611447565b60405180910390f35b6102d460048036038101906102cf919061140d565b610941565b005b6102de610a08565b6040516102eb9190611214565b60405180910390f35b6102fc610a94565b6040516103099190611345565b60405180910390f35b61032c600480360381019061032791906112c5565b610a9a565b604051610339919061131d565b60405180910390f35b61035c600480360381019061035791906113e2565b610ab0565b6040516103699190611345565b60405180910390f35b61038c60048036038101906103879190611460565b610cbb565b6040516103999190611345565b60405180910390f35b6103bc60048036038101906103b791906113e2565b610cdb565b005b5f80546103ca906114cb565b80601f01602080910402602001604051908101604052809291908181526020018280546103f6906114cb565b80156104415780601f1061041857610100808354040283529160200191610441565b820191905f5260205f20905b81548152906001019060200180831161042457829003601f168201915b505050505081565b5f8160075f3373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f205f8573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f20819055508273ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff167f8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925846040516105249190611345565b60405180910390a36001905092915050565b60025481565b5f5f60075f8673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f205f3373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f20549050828110156105f3576040517f13be252b00000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b82810360075f8773ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f205f3373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f20819055503373ffffffffffffffffffffffffffffffffffffffff168573ffffffffffffffffffffffffffffffffffffffff167f8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b92560075f8973ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f205f3373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f20546040516107479190611345565b60405180910390a361075a858585610e89565b60019150509392505050565b7f000000000000000000000000000000000000000000000000000000000000000081565b5f60055f9054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff1614610811576040517f82b4290000000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b61081b838361106b565b6001905092915050565b6008602052805f5260405f205f915090505481565b6006602052805f5260405f205f915090505481565b60045481565b60055f9054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff16146108db576040517f82b4290000000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b806003819055507f07b130fc089b6153dc5748b5d744efe6ec1dd025c8c48e5b105e632f6cbd93da816040516109119190611345565b60405180910390a150565b60055f9054906101000a900473ffffffffffffffffffffffffffffffffffffffff1681565b60055f9054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff16146109c7576040517f82b4290000000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b806004819055507fc49d45d71bf3fd6dfd80cb1d2e6f93faad9e5684754d6b573fda7f694ea56aa2816040516109fd9190611345565b60405180910390a150565b60018054610a15906114cb565b80601f0160208091040260200160405190810160405280929190818152602001828054610a41906114cb565b8015610a8c5780601f10610a6357610100808354040283529160200191610a8c565b820191905f5260205f20905b815481529060010190602001808311610a6f57829003601f168201915b505050505081565b60035481565b5f610aa6338484610e89565b6001905092915050565b5f5f73ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff1603610b16576040517fe6c4247b00000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b5f60085f8473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f2054905080421015610b9c57806040517fc35efe45000000000000000000000000000000000000000000000000000000008152600401610b939190611345565b60405180910390fd5b5f6004541115610bfa5760045442610bb49190611528565b60085f8573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f2081905550610c3d565b4260085f8573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f20819055505b610c498360035461106b565b8273ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff167f8df9ef7404c42e7288b0a32e4eabb433f845a4bbdf35bec2b0aebf43ca498d0c600354604051610ca89190611345565b60405180910390a3600354915050919050565b6007602052815f5260405f20602052805f5260405f205f91509150505481565b60055f9054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff1614610d61576040517f82b4290000000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b5f73ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff1603610dc6576040517fe6c4247b00000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b5f60055f9054906101000a900473ffffffffffffffffffffffffffffffffffffffff1690508160055f6101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055508173ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff167f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e060405160405180910390a35050565b5f73ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff1603610eee576040517fe6c4247b00000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b5f60065f8573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f2054905081811015610f69576040517ff4d678b800000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b81810360065f8673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f20819055508160065f8573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f205f828254610ff99190611528565b925050819055508273ffffffffffffffffffffffffffffffffffffffff168473ffffffffffffffffffffffffffffffffffffffff167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef8460405161105d9190611345565b60405180910390a350505050565b5f73ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff16036110d0576040517fe6c4247b00000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b8060025f8282546110e19190611528565b925050819055508060065f8473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f205f8282546111349190611528565b925050819055508173ffffffffffffffffffffffffffffffffffffffff165f73ffffffffffffffffffffffffffffffffffffffff167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef836040516111989190611345565b60405180910390a35050565b5f81519050919050565b5f82825260208201905092915050565b8281835e5f83830152505050565b5f601f19601f8301169050919050565b5f6111e6826111a4565b6111f081856111ae565b93506112008185602086016111be565b611209816111cc565b840191505092915050565b5f6020820190508181035f83015261122c81846111dc565b905092915050565b5f5ffd5b5f73ffffffffffffffffffffffffffffffffffffffff82169050919050565b5f61126182611238565b9050919050565b61127181611257565b811461127b575f5ffd5b50565b5f8135905061128c81611268565b92915050565b5f819050919050565b6112a481611292565b81146112ae575f5ffd5b50565b5f813590506112bf8161129b565b92915050565b5f5f604083850312156112db576112da611234565b5b5f6112e88582860161127e565b92505060206112f9858286016112b1565b9150509250929050565b5f8115159050919050565b61131781611303565b82525050565b5f6020820190506113305f83018461130e565b92915050565b61133f81611292565b82525050565b5f6020820190506113585f830184611336565b92915050565b5f5f5f6060848603121561137557611374611234565b5b5f6113828682870161127e565b93505060206113938682870161127e565b92505060406113a4868287016112b1565b9150509250925092565b5f60ff82169050919050565b6113c3816113ae565b82525050565b5f6020820190506113dc5f8301846113ba565b92915050565b5f602082840312156113f7576113f6611234565b5b5f6114048482850161127e565b91505092915050565b5f6020828403121561142257611421611234565b5b5f61142f848285016112b1565b91505092915050565b61144181611257565b82525050565b5f60208201905061145a5f830184611438565b92915050565b5f5f6040838503121561147657611475611234565b5b5f6114838582860161127e565b92505060206114948582860161127e565b9150509250929050565b7f4e487b71000000000000000000000000000000000000000000000000000000005f52602260045260245ffd5b5f60028204905060018216806114e257607f821691505b6020821081036114f5576114f461149e565b5b50919050565b7f4e487b71000000000000000000000000000000000000000000000000000000005f52601160045260245ffd5b5f61153282611292565b915061153d83611292565b9250828201905080821115611555576115546114fb565b5b9291505056fea2646970667358221220201b505e942ad884410439cfeeeea430df768755d714693266d4243b86e4386664736f6c634300081e0033' as const;
