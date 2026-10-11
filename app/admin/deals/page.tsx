"use client"
import { useEffect, useState } from "react"
import Link from "next/link"

export default function HomePage(){
  const [products,setProducts]=useState<any[]>([])
  const [activeCat,setActiveCat]=useState("All")
  const [flashIndex,setFlashIndex]=useState(0)
  const [hotIndex,setHotIndex]=useState(0)
  const [newIndex,setNewIndex]=useState(0)

  useEffect(()=>{
    fetch("/api/products?limit=100").then(r=>r.json()).then(d=> setProducts(d.products||d))
  },[])

  useEffect(()=>{ const t=setInterval(()=>setFlashIndex(i=>i+1),3000); return()=>clearInterval(t)},[])
  useEffect(()=>{ const t=setInterval(()=>setHotIndex(i=>i+1),3500); return()=>clearInterval(t)},[])

  const isActive = (p:any)=>!p.dealEnd || new Date(p.dealEnd) > new Date()

  const newArrivals = [...products].reverse().slice(0,10)
  const flashProducts = products.filter((p:any)=> p.isFlashDeal && isActive(p))
  const hotProducts = products.filter((p:any)=> p.isHotDeal && isActive(p))
  const featuredProducts = products.filter((p:any)=> p.isFeatured)
  const categories = ["All",...Array.from(new Set(products.map((p:any)=>p.category).filter(Boolean)))] as string[]
  const categoryProducts = activeCat==="All"? products : products.filter((p:any)=>p.category===activeCat)

  const ProductCard = ({p}:any)=>(
    <Link href={`/product/${p._id||p.id}`} className="border rounded-xl p-3 bg-white hover:shadow-lg block min-w-[250px]">
      <img src={p.images?.[0]||p.image} className="h-40 w-full object-contain" />
      <h3 className="font-semibold mt-2 truncate">{p.name}</h3>
      <p className="text-sm text-gray-500 truncate">{p.category}</p>
      <div className="flex justify-between mt-1">
        <span className="font-bold">Rs. {p.price}</span>
        {p.discountPercent>0 && <span className="text-red-600 font-bold">-{p.discountPercent}%</span>}
      </div>
      <button onClick={(e)=>{e.preventDefault(); alert("Added: "+p.name)}} className="mt-2 w-full bg-black text-white py-2 rounded text-sm">Add to Cart</button>
    </Link>
  )

  return(
    <div className="max-w-7xl mx-auto p-4 space-y-10">

      {/* NEW ARRIVALS - WITH ARROWS LIKE YOUR OLD DESIGN */}
      {newArrivals.length>0 && (
        <section>
          <div className="flex justify-between items-center mb-4">
            <div>
              <p className="text-xs text-red-600 font-bold">NEW ARRIVALS</p>
              <h2 className="text-3xl font-bold">Zavi Collection</h2>
            </div>
            <div className="flex gap-2">
              <button onClick={()=>setNewIndex(i=>Math.max(0,i-1))} className="w-10 h-10 rounded-full border flex items-center justify-center">{"<"}</button>
              <button onClick={()=>setNewIndex(i=>i+1)} className="w-10 h-10 rounded-full border flex items-center justify-center">{">"}</button>
            </div>
          </div>
          <div className="overflow-hidden">
            <div className="flex gap-4 transition-transform duration-500" style={{transform:`translateX(-${(newIndex % newArrivals.length)*268}px)`}}>
              {[...newArrivals,...newArrivals].map((p:any,i:number)=><ProductCard key={i} p={p}/>)}
            </div>
          </div>
        </section>
      )}

      {/* FLASH DEALS - SLIDER ONLY */}
      {flashProducts.length>0 && (
        <section>
          <h2 className="text-2xl font-bold mb-4 text-red-600">⚡ Flash Deals</h2>
          <div className="overflow-hidden">
            <div className="flex gap-4 transition-transform duration-500" style={{transform:`translateX(-${(flashIndex % flashProducts.length)*268}px)`}}>
              {[...flashProducts,...flashProducts].map((p:any,i:number)=><ProductCard key={i} p={p}/>)}
            </div>
          </div>
        </section>
      )}

      {/* HOT DEALS - SLIDER ONLY */}
      {hotProducts.length>0 && (
        <section>
          <h2 className="text-2xl font-bold mb-4 text-orange-600">🔥 Hot Deals</h2>
          <div className="overflow-hidden">
            <div className="flex gap-4 transition-transform duration-500" style={{transform:`translateX(-${(hotIndex % hotProducts.length)*268}px)`}}>
              {[...hotProducts,...hotProducts].map((p:any,i:number)=><ProductCard key={i} p={p}/>)}
            </div>
          </div>
        </section>
      )}

      {/* FEATURED PRODUCTS - NO SLIDER, GRID ONLY */}
      {featuredProducts.length>0 && (
        <section>
          <h2 className="text-2xl font-bold mb-4">⭐ Featured Products</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {featuredProducts.map((p:any)=>(
              <Link key={p._id||p.id} href={`/product/${p._id||p.id}`} className="border rounded-xl p-3 bg-white">
                <img src={p.images?.[0]||p.image} className="h-40 w-full object-contain" />
                <p className="font-semibold truncate mt-2">{p.name}</p>
                <p className="font-bold">Rs. {p.price}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* CATEGORY PRODUCTS - BUTTON CLICK, NO SLIDER */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Shop by Category</h2>
        <div className="flex gap-2 flex-wrap mb-6">
          {categories.map((cat:any)=>(
            <button key={cat} onClick={()=>setActiveCat(cat)} className={`px-5 py-2 rounded-full border ${activeCat===cat? "bg-black text-white":"bg-white"}`}>{cat}</button>
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {categoryProducts.map((p:any)=>(
            <Link key={p._id||p.id} href={`/product/${p._id||p.id}`} className="border rounded-xl p-3 bg-white">
              <img src={p.images?.[0]||p.image} className="h-40 w-full object-contain" />
              <p className="font-semibold truncate mt-2">{p.name}</p>
              <p className="font-bold">Rs. {p.price}</p>
              <button onClick={(e)=>{e.preventDefault(); alert("Added "+p.name)}} className="w-full mt-2 bg-black text-white py-2 rounded text-sm">Add to Cart</button>
            </Link>
          ))}
        </div>
      </section>

    </div>
  )
}