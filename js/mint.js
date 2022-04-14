document.addEventListener('DOMContentLoaded', () => {
	//Unpkg imports
	const Web3Modal = window.Web3Modal.default
	const WalletConnectProvider = window.WalletConnectProvider.default
	const CONTRACTS = {
		4: {
			ALPHA: '0x7B50f0f22b35648ec1110974cb1991FBA25852fF', //FIXME
		},
		1: {
			ALPHA: '', //FIXME
		},
	}

	// ABI
	let alphaAbi
	fetch('./js/abi/alpha.json')
		.then((response) => {
			return response.json()
		})
		.then((data) => (alphaAbi = data))

	let alphaContract
	let provider
	let saleInfo

	const providerOptions = {
		walletconnect: {
			package: WalletConnectProvider,
			options: {
				infuraId: '240248d1c65143c082ae6b411905d45a',
			},
		},
	}

	let web3Modal = new Web3Modal({
		cacheProvider: false,
		providerOptions,
		disableInjectedProvider: false,
	})

	// Show/hide
	const show = el => {
		if (typeof el == "string") {
			el = document.getElementById(el)
		}
		el.removeAttribute("hidden")
	}
	const hide = el => {
		if (typeof el == "string") {
			el = document.getElementById(el)
		}
		el.setAttribute("hidden", true)
	}

	// Update message
	const renderMessage = (message, type) => {
		let el = document.getElementById('message')
		el.classList = type // info, success, error
		el.textContent = message
	}

	const sectionTitle = title => {
		document.getElementById('section-title').textContent = title
	}

	const updateNetwork = async (network) => {
		if (CONTRACTS[network.chainId]) {
			hide(connectBtn)

			const alphaAddr = CONTRACTS[network.chainId].ALPHA

			if (!alphaAddr) {
				// Not available on this network
				// show()
				renderMessage('Not available on this network', 'error')
				return
			}
			const signer = provider.getSigner()
			const addr = await signer.getAddress()

			// Update address display
			const addrDisplay = document.getElementById('address-display')
			addrDisplay.textContent = `${addr.substring(0, 7)}...${addr.substring(
				addr.length - 4,
				addr.length,
			)}`
			try {
				const name = await provider.lookupAddress("0x455fef5aecaccd3a43a4bce2c303392e10f22c63")
				console.log(name)
				if (name) {
					addrDisplay.textContent = name
				}
			} catch (err) {
				console.log(err)
			}

			alphaContract = new ethers.Contract(alphaAddr, alphaAbi, signer)

			saleInfo = await alphaContract.saleInfo(addr)
			if (saleInfo[0].toNumber() === 0) {
				// Not active
				renderMessage('Success! You may proceed to the allowlist mint.', 'success')
				show('proceed-btn')
			} else {
				//FIXME
				return
			}
			//FIXME

			let maxSupply = saleInfo[1].toNumber()
			let currentlyMinted = saleInfo[2].toNumber()

			const mintBar = document.getElementById('minted');
			mintBar.style.width =
				(currentlyMinted / maxSupply) * 80 + 20 + '%'
			mintBar.textContent = `${currentlyMinted} / ${maxSupply}`
			show('minted-counter')
			renderMessage('')
		}
	}

	let connectBtn = document.getElementById('connect-btn')
	connectBtn.addEventListener('click', async () => {
		connectBtn.classList.add('hidden')
		await window.Web3Modal.removeLocal('walletconnect')
		try {
			provider = await web3Modal.connect()
			provider = new ethers.providers.Web3Provider(provider)

			renderMessage('Loading...', 'info')
			provider.on('network', updateNetwork)
		} catch (err) {
			connectBtn.classList.remove('hidden')
			const msg = 'Could not get a wallet connection'
			console.log(msg, err)
			renderMessage(msg, 'error')
		}
	})

	document.getElementById('proceed-btn').addEventListener('click', async () => {
		hide('proceed-btn')
		sectionTitle('Get Alpha Pass')
		if (saleInfo[0].toNumber() == 0) {
			// Paused
			renderMessage('Not available yet. Come back soon.', 'info')
			const bigText = document.getElementById('big-text')
			bigText.textContent = "Paused"
			show(bigText)

		}
	})

	let mintBtn = document.getElementById('mint-btn')
	mintBtn.addEventListener('click', async () => {
		mintBtn.setAttribute('disabled', '')

		let quantityPaidFor = await getQuantity()
		let quantityReceived = await getQuantityWithFree()
		let freeClaim = document.getElementById('free-switch').checked
		try {
			const tx = await alphaContract.functions.mint(
				quantityReceived,
				freeClaim,
				{
					value: (await alphaContract.functions.tokenPrice())[0].mul(
						quantityPaidFor,
					),
				},
			)

			renderMessage('Waiting for confirmation...')
			await tx.wait()

			document.getElementById(
				'success-message',
			).innerText = `You just minted ${quantityReceived} Female Doodles Club tokens.`
			document.getElementById('sale').classList.add('hide')
			document.getElementById('minted').classList.remove('hide')
			renderMessage('')
		} catch (err) {
			console.log(err)
		}
	})

	let quantityInput = document.getElementById('quantity')
	quantityInput.addEventListener('change', async () => {
		updateMintButton()
	})

	let freeSwitch = document.getElementById('free-switch')
	freeSwitch.addEventListener('change', async () => {
		updateMintButton()
	})

	let getQuantity = async () => {
		return parseInt(document.getElementById('quantity').value)
	}

	let getQuantityWithFree = async () => {
		let quantity = await getQuantity()
		let freeClaim = document.getElementById('free-switch').checked
		if (freeClaim) {
			quantity++
		}
		return quantity
	}

	let updateMintButton = async () => {
		let priceInETH = await getTokenPrice()
		let quantity = await getQuantity()
		let quantityWithFree = await getQuantityWithFree()
		const price =
			priceInETH == 0 ? 'FREE' : `${(quantity * priceInETH).toFixed(2)} ETH`
		mintBtn.innerHTML = `Mint ${quantityWithFree} for ${price}`
	}

	let tokenPrice

	let getTokenPrice = async () => {
		if (!tokenPrice) {
			tokenPrice = await alphaContract.functions.tokenPrice()
		}
		let web3 = new Web3(provider)
		return web3.utils.fromWei(tokenPrice[0].toString())
	}

	let mintNowBtn = document.getElementById('buy-btn')
	mintNowBtn.addEventListener('click', () => {
		document.getElementById('mint').scrollIntoView()
	})
})
