import type {ImgHTMLAttributes} from 'react'
import {avatarSrc,avatarSrcSet} from '../lib/api'

type Props=Pick<ImgHTMLAttributes<HTMLImageElement>,'alt'|'className'|'fetchPriority'|'loading'> & {
 avatar?:string
 sizes:string
}

export default function Avatar({avatar,alt='',sizes,...props}:Props){
 return <img {...props} alt={alt} src={avatarSrc(avatar)} srcSet={avatarSrcSet(avatar)} sizes={sizes} width={128} height={128} decoding="async"/>
}
